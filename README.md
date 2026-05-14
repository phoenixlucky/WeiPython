# WeiPython / 尉Python环境管理器

尉Python环境管理器是一个基于 Node.js 与 Electron 的本地桌面工具，用来统一管理 Python、Conda、venv 与 pip 包操作。项目当前采用本地 HTTP 服务 + Electron 桌面壳的结构，适合在 Windows 环境下直接打包为 `exe` 安装程序。

## 主要能力

- 扫描本机已安装的 Python 版本
- 检测 Conda / Miniconda 安装与环境列表
- 创建、克隆、删除 Conda 环境
- 创建、删除 `venv` 虚拟环境
- 在不同环境中安装、升级、卸载 Python 包
- 查看包详情、列出已安装包、从 `requirements.txt` 批量安装
- 在 Windows 上通过 `nvm-windows` 或 `winget` 升级系统 Node.js

## 项目结构

```text
WeiPython/
├── electron/                   # Electron 主进程
├── public/                     # 前端静态资源
├── src/                        # 本地 HTTP 服务与业务逻辑
├── build/                      # 安装器图标、侧边图、NSIS 定制脚本
├── package.json                # npm 脚本与 electron-builder 配置
├── requirements.txt
└── README.md
```

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 启动 Web 服务

```bash
npm run web
```

启动后在浏览器访问：

```text
http://localhost:3210
```

### 3. 启动桌面版

```bash
npm run desktop
```

Electron 会先启动内置本地服务，再打开桌面窗口。

## 生成 Windows 安装包

执行：

```bash
npm run dist
```

默认输出：

```text
dist/WeiPython-Setup-2.4.0.exe
```

如果只想生成解包后的目录产物：

```bash
npm run pack
```

## 安装器配置

当前 Windows 安装器品牌配置如下：

- 软件名称：`尉Python环境管理器`
- 可执行文件：`WeiPython.exe`
- 安装包文件名：`WeiPython-Setup-2.4.0.exe`
- 默认安装目录：`D:\Program Files\WeiPython`
- 安装模式：仅支持机器级安装，不再显示“仅为我安装”
- GitHub 仓库：`https://github.com/phoenixlucky/WeiPython`

相关配置文件：

- `package.json`
- `build/installer.nsh`
- `build/icon.ico`

## 常用操作

### 创建 Conda 环境

1. 进入 `Conda` 页面
2. 输入环境名称
3. 选择按 Python 版本创建，或基于已有环境克隆
4. 查看预估执行动作
5. 点击执行

### 创建虚拟环境

1. 进入 `虚拟环境` 页面
2. 输入环境名称和目标目录
3. 可选填写 Python 路径
4. 点击创建

### 包管理

1. 进入 `包管理` 页面
2. 选择目标环境
3. 输入包名或从已安装包下拉中选择
4. 执行安装、升级、卸载、查询信息或从 `requirements.txt` 安装

### 升级 Node.js

1. 进入 `概览` 页面
2. 点击 `升级 Node.js`
3. 确认后程序会优先调用 `nvm install latest` 与 `nvm use <version>`；未检测到 nvm 时，调用 `winget upgrade --id OpenJS.NodeJS.LTS`
4. 执行完成后概览会刷新系统 Node 与 npm 版本

说明：桌面版 Electron 内置的 Node 版本随应用安装包更新；此功能升级的是系统 Node.js，不会改变当前已运行 Electron 进程内的 Node 版本。

## 说明

- 当前项目主要面向 Windows 使用场景
- Conda 与 pip 的实际执行结果依赖本机环境权限、网络和安装状态
- Node.js 升级依赖本机已启用 `nvm-windows` 或 `winget`，可能需要管理员权限或重新打开终端后 PATH 才会刷新
- 如果安装器默认目录、图标或品牌资源需要继续微调，可以直接修改 `build/` 目录中的资源和 NSIS 配置
