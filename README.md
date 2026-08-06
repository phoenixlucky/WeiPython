# 🐍 WeiPython · 尉Python环境管理器

> 基于 Node.js 与 Electron 的本地桌面工具，统一管理 Python、Conda、venv 与 pip 包操作。

![Version](https://img.shields.io/badge/version-2.8.4-2ea44f)
![Platform](https://img.shields.io/badge/platform-Windows-0078d6)
![Stack](https://img.shields.io/badge/stack-Node.js%20%2B%20Electron-339933)
![License](https://img.shields.io/badge/License-GPLv3-blue.svg)

尉Python环境管理器是一个基于 **Node.js 与 Electron** 的本地桌面工具，用来统一管理 Python、Conda、venv 与 pip 包操作。项目采用 **本地 HTTP 服务 + Electron 桌面壳** 的结构，适合在 Windows 环境下直接打包为 `exe` 安装程序。

---

## ✨ 功能特性

| 领域 | 能力 |
|------|------|
| 🐍 Python | 扫描本机已安装的 Python 版本 |
| 🧪 Conda | 检测 Conda / Miniconda 安装与环境列表；创建、克隆、删除 Conda 环境 |
| 📦 venv | 创建、删除虚拟环境 |
| 🧩 包管理 | 安装、升级、卸载 Python 包；查看包详情、列出已安装包、按 requirements 文件批量安装 |
| 🌐 pip 源 | 安装/升级时可选下载源：官方 PyPI、清华大学、阿里云、中国科大镜像或自定义源 |
| ⚡ 系统维护 | 通过 `nvm-windows` 或 `winget` 升级系统 Node.js |

---

## 🚀 快速开始

| 命令 | 说明 |
|------|------|
| `npm install` | 安装依赖 |
| `npm run web` | 启动本地 Web 服务，浏览器访问 `http://localhost:3210` |
| `npm run desktop` | 启动 Electron 桌面版（先启动内置本地服务，再打开窗口） |
| `npm test` | 运行测试 |

```bash
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
| 安装包文件名 | `WeiPython-Setup-2.8.4.exe` |
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
