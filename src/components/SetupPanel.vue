<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { describeError, invokeCommand } from "@/lib/tauri";
import { chooseDirectory } from "@/lib/dialog";
import { useAppStore } from "@/stores/app";
import { useWorkspaceStore } from "@/stores/workspace";
import ConfirmDialog from "@/components/ConfirmDialog.vue";

const app = useAppStore();
const workspace = useWorkspaceStore();
const status = ref<SetupStatus | null>(null);
const form = reactive({ installPath: "" });
const showCondaTosConfirm = ref(false);
const steps = [
  { label: "检测电脑上的 Conda", progress: 10 },
  { label: "下载并安装最新版 Miniconda", progress: 30 },
  { label: "完成 Miniconda 初始化", progress: 90 },
];

interface SetupStatus {
  recommendedInstallPath: string;
  condaAvailable: boolean;
  condaVersion?: string;
  basePythonVersion?: string;
  rootPrefix?: string;
  environmentCount: number;
}

async function refresh() {
  try {
    status.value = await invokeCommand<SetupStatus>("get_setup_status");
    if (!form.installPath) form.installPath = status.value.recommendedInstallPath;
    await Promise.all([app.refresh().catch(() => undefined), workspace.refreshAll().catch(() => undefined)]);
  } catch (cause) {
    workspace.error = describeError(cause, "检测初始化状态失败");
  }
}

async function initialize() {
  await workspace.startSetup({ installPath: form.installPath });
  if (!workspace.error) await refresh();
}

async function chooseInstallDirectory() {
  try {
    const selected = await chooseDirectory(form.installPath);
    if (selected) form.installPath = selected;
  } catch (cause) { workspace.error = describeError(cause, "选择 Miniconda 安装目录失败"); }
}

async function upgradeConda() {
  const task = await workspace.upgradeConda();
  if (task?.status === "completed") await refresh();
  else if (task?.status === "failed" && workspace.error.includes("需要先接受 Anaconda 官方软件源条款")) showCondaTosConfirm.value = true;
}

async function acceptCondaTosAndUpgrade() {
  showCondaTosConfirm.value = false;
  if (await workspace.acceptCondaTos()) {
    const task = await workspace.upgradeConda();
    if (task?.status === "completed") await refresh();
  }
}

onMounted(refresh);
</script>

<template>
  <section class="content subpage-content setup-page">
    <div class="page-heading"><div><span class="eyebrow">// First-run Setup</span><h1>新电脑初始化配置</h1><p>检测现有 Conda；缺失时安装最新版 Miniconda，不创建 Conda 环境。</p></div><button class="secondary" :disabled="workspace.busy" @click="refresh">重新检测</button></div>
    <div class="setup-layout">
      <article class="card form-card accent-card">
        <div class="card-badge-row"><span class="card-badge">One-click Setup</span><span class="card-badge subtle">Windows x64</span></div>
        <div class="card-heading"><div><h2>安装 Miniconda</h2></div><span>{{ status?.condaAvailable ? '已检测到 Conda · ' + status.environmentCount + ' 个环境' : '等待检测' }}</span></div>
        <p class="setup-intro">适用于新电脑。程序会检测现有 Conda，缺失时静默安装 Miniconda。不会创建首个 Conda 环境，也不会安装额外常用库。</p>
        <div class="form-slab"><label>Miniconda 安装目录<div class="input-action"><input v-model="form.installPath" required :disabled="workspace.busy" /><button class="secondary" type="button" :disabled="workspace.busy" @click="chooseInstallDirectory">选择</button></div></label><div class="setup-facts"><div><span>安装内容</span><strong>Miniconda base</strong></div><div><span>环境创建</span><strong>在 Conda 页面完成</strong></div><div><span>常用库</span><strong>在包管理推荐安装</strong></div></div></div>
        <button class="primary wide" :disabled="workspace.busy || !form.installPath || status?.condaAvailable" @click="initialize">{{ workspace.busy ? '安装中…' : status?.condaAvailable ? 'Miniconda 已就绪' : '安装 Miniconda' }}</button>
      </article>
      <div class="aside-stack">
        <article class="card setup-card"><div class="card-heading"><div><span class="eyebrow">System Maintenance</span><h2>Miniconda 维护</h2></div><span>{{ status?.condaAvailable ? '已连接' : '未检测到' }}</span></div><div class="maintenance-kv"><span>Conda 版本</span><strong>{{ status?.condaVersion || '-' }}</strong><span>base Python</span><strong>{{ status?.basePythonVersion || '-' }}</strong><span>安装目录</span><strong>{{ status?.rootPrefix || '-' }}</strong><span>已登记环境</span><strong>{{ status?.environmentCount ?? 0 }}</strong></div><p class="maintenance-note">{{ status?.condaAvailable ? '只更新 base 中的 Conda 核心包，不修改已有业务环境；升级前会自动备份 base 配置。' : '请先完成 Miniconda 初始化安装。' }}</p><button class="secondary wide" :disabled="workspace.busy || !status?.condaAvailable" @click="upgradeConda">检查并无损升级</button></article>
        <article class="card setup-card"><div class="card-heading"><div><h2>执行步骤</h2></div><span>{{ workspace.currentTask?.progress || 0 }}%</span></div><div class="setup-progress"><span :style="{ width: (workspace.currentTask?.progress || 0) + '%' }"></span></div><ol class="setup-steps"><li v-for="step in steps" :key="step.label" :class="{ active: workspace.currentTask?.status === 'running' && (workspace.currentTask?.progress || 0) <= step.progress, complete: workspace.currentTask?.status === 'completed' || (workspace.currentTask?.status === 'running' && (workspace.currentTask?.progress || 0) > step.progress) }">{{ step.label }}</li></ol></article>
      </div>
    </div>
  </section>
  <ConfirmDialog v-if="showCondaTosConfirm" :open="true" title="需要接受 Anaconda 官方软件源条款" message="本次升级需要访问 Anaconda defaults 软件源。只有在你同意相关服务条款后，程序才会接受条款并继续升级。" confirm-label="接受条款并继续" @confirm="acceptCondaTosAndUpgrade" @cancel="showCondaTosConfirm = false" />
</template>
