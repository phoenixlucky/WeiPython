<div align="center">
  <img src="public/assets/brand/python-mark.png" width="88" alt="WJ Python 管理大师图标">
  <h1>WJ Python 管理大师</h1>
  <p>在一个桌面应用中管理 Python、Conda、虚拟环境和软件包</p>
  <p>
    <a href="https://github.com/phoenixlucky/WeiPython/releases/tag/v3.1.3"><img src="https://img.shields.io/badge/版本-3.1.3-2563EB" alt="版本 3.1.3"></a>
    <img src="https://img.shields.io/badge/平台-Windows-0A66C2" alt="平台 Windows">
    <a href="LICENSE"><img src="https://img.shields.io/badge/许可证-GPL--3.0-4B5563" alt="GPL-3.0 许可证"></a>
  </p>
</div>

WJ Python 管理大师是一款面向 Windows 的本地 Python 环境管理工具。它把 Python、Conda、`venv`、`uv` 和 `pip` 的常用操作集中到一个桌面应用中，方便查看环境、管理依赖和维护本机 Python 工具链。

> **SSVIP 仅供娱乐：** 会员与付费提示是应用内的主题体验彩蛋，不代表真实商品、收费或服务，也不会触发支付。体验密钥：`greed is good`。

## 界面预览

<table>
  <tr>
    <td align="center"><strong>环境概览</strong><br><img src="public/assets/screenshots/overview.webp" alt="环境概览" width="100%"></td>
    <td align="center"><strong>Python 版本管理</strong><br><img src="public/assets/screenshots/python-versions.webp" alt="Python 版本管理" width="100%"></td>
  </tr>
  <tr>
    <td align="center"><strong>Python 包管理</strong><br><img src="public/assets/screenshots/package-management.webp" alt="Python 包管理" width="100%"></td>
    <td align="center"><strong>SSVIP 主题体验</strong><br><img src="public/assets/screenshots/ssvip.webp" alt="SSVIP 主题体验" width="100%"></td>
  </tr>
</table>

## 功能一览

| 环境与运行时 | 环境与依赖 |
| --- | --- |
| 查看 Python、Conda、虚拟环境和平台状态 | 安装、升级、卸载和查询 Python 包 |
| 初始化 Miniconda，创建首个 Python 环境 | 从 `requirements.txt` 批量安装依赖 |
| 创建、克隆、删除 Conda 环境，导入或导出 YAML | 创建和扫描 `venv`、`uv` 环境，包括项目 `.venv` |
| 扫描本机 Python，查询版本并升级受支持的解释器 | 安装、管理 uv，导入或导出环境依赖 |
| 查看任务日志和运行中的进程 | 自定义首页标语、背景和配色 |

## 下载与启动

当前版本：**3.1.3** · [前往 GitHub Releases 下载](https://github.com/phoenixlucky/WeiPython/releases/tag/v3.1.3)

- `*-setup.exe`：安装版，适合日常使用。
- `WJPythonManager-3.1.3-x64-portable.exe`：Windows x64 便携版，无需安装。

首次启动后，打开左侧的“初始化配置”，按向导检查 Conda 并设置 Python 环境。

## 从源码运行

开发环境需要 Node.js 24 或更高版本，以及 Rust 工具链。

```bash
npm install
npm run tauri:dev
```

运行项目测试：

```bash
npm test
```

## 快速上手

### 初始化环境

1. 打开“初始化配置”，点击“重新检测”。
2. 如果尚未安装 Conda，选择 Miniconda 安装目录和 Python 版本。
3. 按需选择常用库，然后点击“开始初始化”。
4. 完成后回到“概览”查看环境状态。

### 管理环境和 Python

在“Conda”页面创建或克隆环境，查看路径、Python 版本和包数量，也可以导入或导出 YAML 配置。进入“虚拟环境”可创建或扫描 `venv` 和 `uv` 环境；在“Python 版本”页面扫描本机解释器，查询 Conda 可用版本，或升级受支持的 Python。

系统 Python、Conda、`venv` 和 `uv` 环境彼此独立。请使用各自对应的管理方式维护。

### 管理软件包

1. 在“包管理”选择目标环境。
2. 输入包名，或从已安装包列表选择。
3. 执行安装、升级、卸载或版本查询；安装时可使用最新版本、当前版本或手动指定版本。
4. 批量安装时选择 `requirements.txt` 文件。

安装和升级前可以设置 pip 源。命令输出和操作结果会显示在运行日志中。

## 使用须知

- 软件主要面向 Windows，通过本机的 Python、Conda、pip、uv 和 Windows 工具管理环境。
- 创建环境、安装软件包和升级 Python 可能需要网络，并受本机权限及软件源状态影响。
- 删除环境或卸载软件包会修改本机环境；操作前请确认目标。`base` 环境不能直接删除。
- 设置和运行日志默认保存在本机，不上传到服务器。
- SSVIP 密钥是源码中的本地演示密钥，不是安全凭证或真实付费授权：`greed is good`。

## 开源协议

本项目基于 [GNU General Public License v3.0](LICENSE) 开源。

[项目主页](https://github.com/phoenixlucky/WeiPython) · [版本发布](https://github.com/phoenixlucky/WeiPython/releases)
