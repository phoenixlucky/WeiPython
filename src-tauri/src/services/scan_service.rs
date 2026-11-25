use std::future::Future;
use std::sync::{atomic::{AtomicU64, Ordering}, Arc, OnceLock};
use std::time::{Duration, Instant};

pub const SCAN_TTL: Duration = Duration::from_secs(15);

pub struct ScanCache<T> {
    value: tokio::sync::Mutex<Option<(String, Instant, u64, T)>>,
    generation: AtomicU64,
    ttl: Duration,
}

impl<T: Clone> ScanCache<T> {
    pub const fn new(ttl: Duration) -> Self {
        Self { value: tokio::sync::Mutex::const_new(None), generation: AtomicU64::new(0), ttl }
    }

    pub fn invalidate(&self) { self.generation.fetch_add(1, Ordering::SeqCst); }

    pub async fn get<F, Fut>(&self, key: &str, load: F) -> Result<T, String>
    where F: FnOnce() -> Fut, Fut: Future<Output = Result<T, String>> {
        let mut entry = self.value.lock().await;
        let generation = self.generation.load(Ordering::SeqCst);
        if let Some((saved_key, time, saved_generation, value)) = entry.as_ref() {
            if saved_key == key && *saved_generation == generation && time.elapsed() < self.ttl { return Ok(value.clone()); }
        }
        let value = load().await?;
        if self.generation.load(Ordering::SeqCst) == generation {
            *entry = Some((key.to_string(), Instant::now(), generation, value.clone()));
        }
        Ok(value)
    }
}

pub async fn bounded_map<T, R, F, Fut>(items: Vec<T>, probe: F) -> Vec<R>
where T: Send + 'static, R: Send + 'static, F: Fn(T) -> Fut, Fut: Future<Output = R> + Send + 'static {
    static SLOTS: OnceLock<Arc<tokio::sync::Semaphore>> = OnceLock::new();
    let slots = SLOTS.get_or_init(|| Arc::new(tokio::sync::Semaphore::new(4)));
    let mut jobs = tokio::task::JoinSet::new();
    let mut result = Vec::with_capacity(items.len());
    for item in items {
        let slots = slots.clone();
        let future = probe(item);
        jobs.spawn(async move { let _permit = slots.acquire_owned().await.expect("probe semaphore is never closed"); future.await });
        if jobs.len() >= 4 { if let Some(Ok(value)) = jobs.join_next().await { result.push(value); } }
    }
    while let Some(value) = jobs.join_next().await { if let Ok(value) = value { result.push(value); } }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};

    #[tokio::test]
    async fn caches_shared_requests_and_invalidates_after_a_change() {
        let cache = ScanCache::new(std::time::Duration::from_secs(15));
        let calls = AtomicUsize::new(0);
        let load = || async { calls.fetch_add(1, Ordering::SeqCst); Ok::<_, String>(42) };
        let (first, second) = tokio::join!(cache.get("same", load), cache.get("same", load));
        assert_eq!(first.unwrap(), 42); assert_eq!(second.unwrap(), 42);
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        cache.invalidate();
        assert_eq!(cache.get("same", load).await.unwrap(), 42);
        assert_eq!(calls.load(Ordering::SeqCst), 2);
        cache.get("different-tool", load).await.unwrap();
        assert_eq!(calls.load(Ordering::SeqCst), 3);
    }

    #[tokio::test]
    async fn failed_loads_are_not_cached_and_expired_entries_are_reloaded() {
        let cache = ScanCache::new(std::time::Duration::from_millis(1));
        assert!(cache.get("key", || async { Err::<u32, _>("failed".to_string()) }).await.is_err());
        assert_eq!(cache.get("key", || async { Ok(1) }).await.unwrap(), 1);
        tokio::time::sleep(std::time::Duration::from_millis(5)).await;
        assert_eq!(cache.get("key", || async { Ok(2) }).await.unwrap(), 2);
    }

    #[tokio::test]
    async fn probes_run_in_parallel_but_never_exceed_four_children() {
        let active = Arc::new(AtomicUsize::new(0));
        let peak = Arc::new(AtomicUsize::new(0));
        let result = bounded_map((0..12).collect(), move |value| {
            let active = active.clone(); let peak = peak.clone();
            async move {
                let count = active.fetch_add(1, Ordering::SeqCst) + 1;
                peak.fetch_max(count, Ordering::SeqCst);
                tokio::time::sleep(std::time::Duration::from_millis(5)).await;
                active.fetch_sub(1, Ordering::SeqCst);
                (value, peak.load(Ordering::SeqCst))
            }
        }).await;
        assert_eq!(result.len(), 12);
        let highest = result.iter().map(|(_, count)| *count).max().unwrap();
        assert!(highest > 1 && highest <= 4);
    }
}
