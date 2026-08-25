# 🐍 WeiPython · 尉Python环境管理器

> 基于 Node.js 与 Electron 的本地桌面工具，统一管理 Python、Conda、venv 与 pip 包操作。

![Version](https://img.shields.io/badge/version-2.8.7-2ea44f)
![Platform](https://img.shields.io/badge/platform-Windows-0078d6)
![Stack](https://img.shields.io/badge/stack-Node.js%20%2B%20Electron-339933)
![License](https://img.shields.io/badge/License-GPLv3-blue.svg)

尉Python环境管理器是一个基于 **Node.js 与 Electron** 的本地桌面工具，用来统一管理 Python、Conda、venv 与 pip 包操作。项目采用 **本地 HTTP 服务 + Electron 桌面壳** 的结构，适合在 Windows 环境下直接打包为 `exe` 安装程序。

---

## ✨ 功能特性

| 领域 | 能力 |
|------|------|
| 🖥️ 概览 | 系统状态总览、一键升级系统 Node.js |
| 🚀 初始化配置 | 首次运行向导、Miniconda 安装与升级 |
| 🧪 Conda | 环境创建 / 克隆 / 删除、YAML 导入导出、软件源切换、Python 版本查询 |
| 🐍 Python | 本机 Python 扫描、Conda 环境 Python 无损升级 |
| 📦 venv | 虚拟环境创建、删除 |
| 🧩 包管理 | 安装 / 升级 / 卸载 / 批量升级 / requirements 安装、pip 源选择 |
| 📋 日志 | 统一运行日志面板、活跃进程监控 |
| 🎨 外观 | 自定义背景壁纸、首页标语与整体配色 |

### 🖥️ 概览面板

- 一键展示系统核心状态：Node.js、npm、Conda、Python 版本一览
- 一键**升级系统 Node.js**：优先调用 `nvm install latest` + `nvm use <version>`，未检测到 nvm 时自动回退 `winget upgrade --id OpenJS.NodeJS.LTS`

### 🚀 初始化配置

- **首次运行向导**：检测本机 Python / Conda 安装情况，引导完成环境初始化
- **Miniconda 管理**：未安装时引导安装；已安装时先查询可用版本、经用户确认后升级
- 初始化任务全程实时输出进度与日志

### 🧪 Conda 环境管理

- 检测 Conda / Miniconda 安装与**环境列表**，展示 Python 版本、包数量等概览
- **创建环境**：按指定 Python 版本创建，或基于已有环境**克隆**
- **删除环境**：执行前预览预估动作，确认后执行
- **YAML 导入导出**：单个环境或全部环境导出为 YAML，支持一键生成默认导出路径
- **软件源切换**：官方源 / conda-forge 等渠道切换，版本查询与安装统一按当前渠道执行
- **Python 版本查询**：查询当前渠道可用版本并缓存（独立计时，可手动刷新）

### 🐍 Python 版本管理

- 扫描本机**已安装的 Python 版本**
- **Conda 环境 Python 无损升级**：查询可升级的稳定版本 → 升级前 dry-run 依赖求解（无法求解的版本不允许升级）→ 备份 → 升级 → 升级后校验环境路径，全程可追踪进度

### 📦 venv 虚拟环境

- 创建虚拟环境：指定名称与目标目录，可选指定 Python 路径
- 删除虚拟环境

### 🧩 包管理

- 基础操作：**安装、升级、卸载** Python 包
- 查询：查看包详情、列出已安装包、查询最新版本
- 批量操作：**一键升级所有过期包**、单独**升级 pip**
- **requirements 文件**：从指定文件批量安装
- **pip 下载源选择**：官方 PyPI、清华大学、阿里云、中国科大镜像或自定义源，安装/升级/批量升级均通过 `--index-url` 使用所选源；自定义地址校验 http/https 协议
- 异步任务执行：安装等耗时操作后台运行，实时输出命令、进程 PID 与执行日志；长时间无输出时提示切换 pip 源

### 📋 运行日志与进程监控

- **统一运行日志面板**：所有面板的操作输出集中展示，支持一键清空
- **活跃进程监控**：任务运行期间实时显示子进程 PID、运行时长与命令，任务完成后自动停止轮询

### 🎨 外观设置

- **自定义背景壁纸**：导入本地图片作为背景（支持 png / jpeg / webp / bmp / gif / avif，≤20MB，自动压缩至最长边 2560px 并转为 webp 格式减小体积），或一键恢复默认壁纸
- **首页标语文字**：自定义首页标语（最多 60 字），可恢复默认
- **整体配色**：主色 / 辅助色 / 文字色三档颜色自由调整，可一键恢复默认配色
- **持久化**：外观配置通过 `GET/PUT /api/skin` 持久化至本机用户数据目录 `userData/skin.json`（随机端口下重启不丢失），支持增量合并与并发写保护；`localStorage` 作为兜底并自动回写
- 入口：侧边栏「🎨 外观设置」按钮或菜单栏「外观设置」子菜单（打开外观设置 / 导入背景壁纸 / 恢复默认壁纸）
- 所有外观设置仅保存在本机，数据不离开本地

---

## 🚀 快速开始

> **环境要求：Node.js ≥ 24**（推荐通过 [nvm-windows](https://github.com/coreybutler/nvm-windows) 管理）。项目根目录已提供 `.nvmrc`，在项目目录执行 `nvm use` 即可自动切换到 Node 24。

| 命令 | 说明 |
|------|------|
| `nvm use` | 按 `.nvmrc` 切换到 Node 24 |
| `npm install` | 安装依赖 |
| `npm run web` | 启动本地 Web 服务，浏览器访问 `http://localhost:3210` |
| `npm run desktop` | 启动 Electron 桌面版（先启动内置本地服务，再打开窗口） |
| `npm test` | 运行测试 |

```bash
nvm use             # 切换到 Node 24（如未安装：nvm install 24 && nvm use）
npm install
npm run web        # 浏览器访问 http://localhost:3210
npm run desktop    # 或直接启动桌面版
```

---

## 📦 打包发布

### 生成 Windows 安装包

```bash
npm run dist
```

默认输出：`dist/WeiPython-Setup.exe`

### 免安装目录产物

```bash
npm run pack
```

只生成解包后的目录（`win-unpacked`），不生成安装程序，速度更快。

### 一键打包

Windows 下可直接运行项目根目录的 **`一键打包.bat`**，交互式完成：

1. 显示当前版本号，可输入新版本号（`X.Y.Z` 或 `X.Y.Z-beta.1`，由 `scripts/set-version.mjs` 校验并同步更新）
2. 选择打包模式：① 完整安装包（NSIS） ② 免安装目录

---

## ⚙️ 安装器配置

| 项目 | 值 |
|------|-----|
| 软件名称 | `尉Python环境管理器` |
| 软件公司 | `尉缭子科技` |
| 可执行文件 | `WeiPython.exe` |
| 安装包文件名 | `WeiPython-Setup-2.9.2.exe` |
| 默认安装目录 | `D:\Program Files\WeiPython` |
| 安装模式 | 仅机器级安装（不再显示“仅为我安装”） |
| GitHub 仓库 | <https://github.com/phoenixlucky/WeiPython> |

相关配置：`package.json` · `build/installer.nsh` · `build/icon.ico`

---

## 📖 常用操作

### 🧪 创建 Conda 环境

1. 进入 `Conda` 页面
2. 输入环境名称
3. 选择按 Python 版本创建，或基于已有环境克隆
4. 查看预估执行动作
5. 点击执行

### 📦 创建虚拟环境

1. 进入 `虚拟环境` 页面
2. 输入环境名称和目标目录
3. 可选填写 Python 路径
4. 点击创建

### 🧩 包管理

1. 进入 `包管理` 页面
2. 选择目标环境
3. 输入包名或从已安装包下拉中选择
4. 执行安装、升级、卸载、查询信息，或从指定 requirements 文件安装
5. 安装/升级前可切换 pip 下载源（官方 / 清华 / 阿里云 / 中科大 / 自定义）

### ⚡ 升级 Node.js

1. 进入 `概览` 页面
2. 点击 `升级 Node.js`
3. 确认后优先调用 `nvm install latest` 与 `nvm use <version>`；未检测到 nvm 时调用 `winget upgrade --id OpenJS.NodeJS.LTS`
4. 完成后概览会刷新系统 Node 与 npm 版本

> 💡 说明：桌面版 Electron 内置的 Node 版本随应用安装包更新；此功能升级的是**系统 Node.js**，不会改变当前已运行 Electron 进程内的 Node 版本。

---

## 📁 项目结构

```text
WeiPython/
├── electron/                   # Electron 主进程与预加载脚本
├── public/                     # 前端静态资源
├── src/                        # 本地 HTTP 服务与业务逻辑
├── test/                       # Node.js 测试
├── scripts/                    # 项目维护脚本
├── build/                      # 安装器图标、侧边图、NSIS 定制脚本
├── package.json                # npm 脚本与 electron-builder 配置
├── 一键打包.bat                # Windows 交互式打包入口
└── README.md
```

---

## 📄 开源协议

本项目基于 **GNU General Public License v3.0（GPL-3.0）** 开源发布。

- Copyright (C) 2026 **尉缭子科技**
- 许可证全文见 [LICENSE](LICENSE) 文件
- 官方文本：<https://www.gnu.org/licenses/gpl-3.0.html>

> 📌 GPL-3.0 为强 copyleft 协议：你可以自由使用、修改与分发，但分发**修改后的衍生作品**时，必须以相同协议开源并提供对应源代码。

---

## 📌 说明

- 当前项目主要面向 **Windows** 使用场景
- Conda 与 pip 的实际执行结果依赖本机环境权限、网络和安装状态
- Node.js 升级依赖本机已启用 `nvm-windows` 或 `winget`，可能需要管理员权限；重新打开终端后 PATH 才会刷新
- 如需微调安装器默认目录、图标或品牌资源，可直接修改 `build/` 目录中的资源和 NSIS 配置
