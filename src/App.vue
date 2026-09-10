<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { onMounted, onUnmounted, ref } from "vue";
import { useAppStore } from "@/stores/app";
import CondaPanel from "@/components/CondaPanel.vue";
import VenvPanel from "@/components/VenvPanel.vue";
import PackagesPanel from "@/components/PackagesPanel.vue";
import PythonPanel from "@/components/PythonPanel.vue";
import SetupPanel from "@/components/SetupPanel.vue";
import SettingsPanel from "@/components/SettingsPanel.vue";
import UvPanel from "@/components/UvPanel.vue";
import { useWorkspaceStore } from "@/stores/workspace";
import { isTauri } from "@/lib/tauri";

const app = useAppStore();
const workspace = useWorkspaceStore();
const activePanel = ref("overview");
const panels = [
  { id: "overview", icon: "ph:house-fill", label: "概览" },
  { id: "setup", icon: "ph:gear", label: "初始化配置" },
  { id: "conda", icon: "ph:database", label: "Conda" },
  { id: "python", icon: "ph:brackets-curly", label: "Python 版本" },
  { id: "venv", icon: "ph:cube", label: "虚拟环境" },
  { id: "uv", icon: "ph:package", label: "uv 管理" },
  { id: "packages", icon: "ph:package", label: "包管理" },
  { id: "settings", icon: "ph:sliders-horizontal", label: "客户端设置" },
];
const navGroups = [
  { label: "工作区", items: ["overview"] },
  { label: "运行时", items: ["setup", "conda", "python", "uv"] },
  { label: "环境与包", items: ["venv", "packages"] },
  { label: "系统", items: ["settings"] },
];
const previewEnvironments = [
  { name: "base", prefix: "D:\\ProgramData\\miniconda3", python: "3.14.7", packageCount: 124, active: true },
  { name: "paddleocr", prefix: "D:\\ProgramData\\miniconda3\\envs\\paddleocr", python: "3.11.15", packageCount: 52, active: false },
  { name: "py3146", prefix: "D:\\ProgramData\\miniconda3\\envs\\py3146", python: "3.14.6", packageCount: 55, active: false },
  { name: "py3147", prefix: "D:\\ProgramData\\miniconda3\\envs\\py3147", python: "3.14.7", packageCount: 54, active: false },
  { name: "trend-forecasting-py", prefix: "D:\\ProgramData\\miniconda3\\envs\\trend-forecasting-py", python: "3.10.20", packageCount: 20, active: false },
];
const previewVenvs = [
  { name: "studio-venv", path: "D:\\Projects\\studio-venv", manager: "venv", pythonVersion: "3.12" },
  { name: "docs-uv", path: "D:\\Projects\\docs-uv", manager: "uv", pythonVersion: "3.13" },
];
let processTimer = 0;

function panelFor(id: string) { return panels.find((panel) => panel.id === id); }

onMounted(async () => {
  await app.loadSettings();
  if (isTauri) {
    await Promise.all([app.refresh(), workspace.loadVenvs(), workspace.loadPythonVersions()]);
    if (app.overview) workspace.conda = app.overview.environments;
    await workspace.loadProcesses().catch(() => undefined);
    processTimer = window.setInterval(() => { void workspace.loadProcesses().catch(() => undefined); }, 1000);
  } else {
    app.overview = { runtime: { python: "3.14.7", conda: "26.7.2", platform: "Windows" }, environments: previewEnvironments, checkedAt: new Date().toISOString() };
    workspace.conda = previewEnvironments;
    workspace.venvs = previewVenvs;
    workspace.pythonVersions = ["3.14.7", "3.14.6", "3.13.5", "3.12.10"];
  }
});

onUnmounted(() => { if (processTimer) window.clearInterval(processTimer); });
</script>

<template>
  <div class="app-shell" :class="{ compact: app.settings.compactMode }" :style="{ '--client-primary': app.settings.primary, '--client-secondary': app.settings.secondary, '--client-ink': app.settings.ink }">
    <aside class="sidebar">
      <div class="brand-block">
        <div class="brand-mark"><span class="brand-icon"><Icon class="brand-logo" icon="logos:python" /></span><span class="brand-copy"><strong>WJ Python</strong><small>管理大师</small></span></div>
        <p>本地优先的 Python 环境控制台</p>
      </div>
      <div v-for="(group, groupIndex) in navGroups" :key="group.label" class="sidebar-section" :class="{ 'sidebar-section-first': groupIndex === 0 }">
        <span class="section-label">{{ group.label }}</span>
        <nav>
          <button v-for="panelId in group.items" :key="panelId" :class="{ active: activePanel === panelId }" :aria-label="panelFor(panelId)?.label" :title="panelFor(panelId)?.label" @click="activePanel = panelId">
            <Icon class="nav-icon" :icon="panelFor(panelId)?.icon || 'ph:circle'" width="19" height="19" /><span class="nav-label">{{ panelFor(panelId)?.label }}</span>
          </button>
        </nav>
      </div>
      <div class="sidebar-foot"><span class="status-dot" :class="{ busy: app.loading }"></span><span>{{ app.loading ? "读取中" : "系统就绪" }}</span><small>本地运行</small></div>
    </aside>

    <main class="main-stage">
      <header class="topbar">
        <div class="topbar-context"><span class="topbar-dot"></span><div><strong>Python 工作区</strong><span>环境统筹 · 一切正常</span></div></div>
        <div class="runtime-chips"><span>Python {{ app.overview?.runtime.python || "--" }}</span><span>Conda {{ app.overview?.runtime.conda || "--" }}</span><span class="target-chip">环境 {{ workspace.targets.length || app.overview?.environments.length || 0 }}</span></div>
      </header>
      <div v-if="app.error" class="error-banner global-error-banner" role="alert">{{ app.error }}<button class="link-button" @click="app.error = ''">关闭</button></div>

      <section v-if="activePanel === 'overview'" class="content overview-content">
        <div class="hero-panel" :style="{ '--hero-image': `url(${app.settings.wallpaper || '/assets/illustrations/dashboard-hero.png'})` }">
          <div class="hero-copy"><span class="eyebrow hero-eyebrow">// Overview</span><h1>系统与运行时总览</h1><p>查看本机 Python 工具链和 Conda 环境状态，轻松管理您的开发环境。</p></div>
          <button class="hero-refresh" :disabled="app.loading" @click="app.refresh"><Icon icon="ph:arrows-clockwise" :class="{ spin: app.loading }" />{{ app.loading ? "刷新中" : "刷新状态" }}</button>
        </div>

        <div class="stat-grid">
          <article class="stat-card python-card"><div class="stat-icon"><Icon class="brand-iconify python-logo" icon="logos:python" /></div><div class="stat-copy"><span>Python 版本</span><strong>{{ app.overview?.runtime.python || "--" }}</strong><small>系统默认解释器</small></div><button class="stat-arrow" aria-label="查看 Python 版本" @click="activePanel = 'python'"><Icon icon="ph:caret-right" /></button></article>
          <article class="stat-card conda-card"><div class="stat-icon"><Icon icon="ph:database-fill" /></div><div class="stat-copy"><span>Conda 环境</span><strong>{{ app.overview?.environments.length ?? "--" }}</strong><small>已发现环境</small></div><button class="stat-arrow" aria-label="查看 Conda 环境" @click="activePanel = 'conda'"><Icon icon="ph:caret-right" /></button></article>
          <article class="stat-card venv-card"><div class="stat-icon"><Icon icon="ph:monitor" /></div><div class="stat-copy"><span>虚拟环境</span><strong>{{ workspace.venvs.length }}</strong><small>包含 uv 创建的环境</small></div><button class="stat-arrow" aria-label="查看虚拟环境" @click="activePanel = 'venv'"><Icon icon="ph:caret-right" /></button></article>
          <article class="stat-card platform-card"><div class="stat-icon"><Icon class="brand-iconify windows-logo" icon="ph:windows-logo-fill" /></div><div class="stat-copy"><span>平台</span><strong>{{ app.overview?.runtime.platform || "--" }}</strong><small>操作系统</small></div><button class="stat-arrow" aria-label="查看客户端设置" @click="activePanel = 'settings'"><Icon icon="ph:caret-right" /></button></article>
        </div>

        <div class="dashboard-grid">
          <article class="card environment-card">
            <div class="card-heading environment-heading"><div class="heading-with-icon"><span class="section-icon"><Icon icon="ph:monitor" /></span><div><h2>可管理环境</h2><p>共 {{ app.overview?.environments.length || 0 }} 个环境，支持 Conda 环境与虚拟环境的统一管理</p></div></div><div class="heading-tools"><span><Icon icon="ph:clock" />{{ app.lastRefreshLabel }}</span><button class="icon-button" aria-label="刷新环境" @click="app.refresh"><Icon icon="ph:arrows-clockwise" /></button></div></div>
            <div class="environment-table-head"><span>环境名称</span><span>环境路径</span><span>版本</span><span>包数量</span><span>操作</span></div>
            <div v-if="!app.overview?.environments.length && !app.loading" class="empty">没有发现 Conda 环境</div>
            <div v-for="environment in app.overview?.environments" :key="environment.prefix" class="environment-row">
              <div class="env-name"><Icon class="row-python-logo" icon="logos:python" /><strong>{{ environment.name }}</strong></div><div class="env-path">{{ environment.prefix }}</div><div class="env-version">{{ environment.python }}</div><div class="env-packages">{{ environment.packageCount }} 个包</div><button class="row-action" :disabled="workspace.busy" @click="activePanel = 'conda'"><Icon icon="ph:gear-six" />管理</button><button class="more-button" aria-label="更多操作"><Icon icon="ph:dots-three-vertical" /></button>
            </div>
          </article>
          <article class="card next-card"><div class="next-heading"><span class="section-icon rocket-icon"><Icon icon="ph:rocket-launch" /></span><div><h2>下一步</h2><strong>继续管理环境</strong></div></div><p>所有环境都可以进入同一套包管理流程。先选择环境类型，再执行创建、升级或安装。</p><button class="next-action" @click="activePanel = 'conda'"><span class="action-icon"><Icon icon="ph:plus-circle-fill" /></span><span><strong>创建新环境</strong><small>创建 Conda 或虚拟环境</small></span><Icon class="action-chevron" icon="ph:caret-right" /></button><button class="next-action" @click="activePanel = 'packages'"><span class="action-icon"><Icon icon="ph:cube" /></span><span><strong>安装软件包</strong><small>在选定环境中安装包</small></span><Icon class="action-chevron" icon="ph:caret-right" /></button><button class="next-action" @click="activePanel = 'python'"><span class="action-icon upgrade"><Icon icon="ph:caret-up-fill" /></span><span><strong>升级现有环境</strong><small>更新 Python 或包版本</small></span><Icon class="action-chevron" icon="ph:caret-right" /></button><button class="next-action" @click="activePanel = 'settings'"><span class="action-icon"><Icon icon="ph:book-open" /></span><span><strong>查看帮助文档</strong><small>了解更多使用技巧</small></span><Icon class="action-chevron" icon="ph:caret-right" /></button><div class="next-decoration"><span>更好的开发体验</span><small>从优雅的环境管理开始</small></div></article>
        </div>
      </section>

      <CondaPanel v-else-if="activePanel === 'conda'" />
      <VenvPanel v-else-if="activePanel === 'venv'" />
      <UvPanel v-else-if="activePanel === 'uv'" />
      <PackagesPanel v-else-if="activePanel === 'packages'" />
      <PythonPanel v-else-if="activePanel === 'python'" />
      <SetupPanel v-else-if="activePanel === 'setup'" />
      <SettingsPanel v-else-if="activePanel === 'settings'" />
      <section v-else class="content placeholder-page"><span class="eyebrow">// {{ activePanel }}</span><h1>{{ panelFor(activePanel)?.label }}</h1><div class="card"><h2>模块已接入迁移骨架</h2><p>这里将接入 Rust domain/service 能力。当前基础链路已可运行。</p><button class="secondary" @click="activePanel = 'overview'">返回概览</button></div></section>
      <div v-if="workspace.error || workspace.message || workspace.output || workspace.currentTask" class="operation-log" :class="{ 'operation-error': workspace.error, 'operation-running': workspace.currentTask?.status === 'running' }" role="status" aria-live="polite"><div class="log-head"><span class="log-status-dot"></span><strong>{{ workspace.error || workspace.message || workspace.currentTask?.message || "最近一次操作" }}</strong><span v-if="workspace.currentTask?.status === 'running'">{{ workspace.currentTask.progress }}%</span><button v-if="workspace.currentTask?.status === 'running'" class="link-button" @click="workspace.cancelCurrentTask">取消任务</button><button class="link-button" @click="workspace.clearLog">清空</button></div><div v-if="workspace.currentTask?.status === 'running'" class="task-progress"><span :style="{ width: `${workspace.currentTask.progress}%` }"></span></div><small v-if="workspace.activeProcesses.length" class="process-note">正在运行 {{ workspace.activeProcesses.length }} 个本地进程</small><pre v-if="workspace.output">{{ workspace.output }}</pre></div>
    </main>
  </div>
</template>

<style scoped>
.operation-log { position: sticky; bottom: 16px; z-index: 5; margin: 0 44px 24px; padding: 14px 16px; border: 1px solid #dfe6ef; border-radius: 14px; background: rgba(255,255,255,.96); box-shadow: 0 12px 28px rgba(15,23,42,.12); color: #556479; font-size: 12px; }
.log-head { display: flex; align-items: center; gap: 12px; }.log-head span { color: #8490a3; margin-left: auto; }.log-head .link-button { margin-left: 8px; }.operation-log strong { color: #2563eb; }.operation-error strong { color: #be123c; }.log-status-dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: #22c55e; }.operation-running .log-status-dot { background: #f59e0b; }.operation-error .log-status-dot { background: #e11d48; }.task-progress { height: 5px; overflow: hidden; margin-top: 10px; border-radius: 99px; background: #e8eef7; }.task-progress span { display: block; height: 100%; border-radius: inherit; background: var(--client-primary, #2563eb); transition: width .2s ease; }.process-note { display: block; margin-top: 8px; color: #8490a3; }.operation-log pre { max-height: 220px; overflow: auto; margin: 10px 0 0; white-space: pre-wrap; font: 11px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; color: #66758b; }
:global(.app-shell) { background: #eef5fb; }.spin { animation: spin 1s linear infinite; }@keyframes spin { to { transform: rotate(360deg); } }
:global(.primary) { background: var(--client-primary, #2563eb); }:global(.secondary), :global(.link-button) { color: var(--client-primary, #2563eb); }:global(.page-heading h1), :global(.placeholder-page h1) { color: var(--client-ink, #10234f); }
</style>
