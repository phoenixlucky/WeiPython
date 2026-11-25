<script setup lang="ts">
defineProps<{ value: number | null; label: string }>();
</script>

<template>
  <progress class="task-progress" max="100" :value="value ?? undefined" :aria-label="label"></progress>
</template>
