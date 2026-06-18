# 更新日志
## v2.7.1 - Conda 更新残留文件清理 (2026-06-18)

### 🐛 Bug 修复

- ✅ 新增 `cleanupStaleCondaUpdateArtifacts` 自动清理 conda update 产生的残留临时文件（`conda.exe.c~` 及 `.conda_trash` 标记）
- ✅ 新增 `isRecoverableCondaCleanupFailure` 识别可安全忽略的 conda 清理错误
- ✅ 在 Miniconda 升级流程中自动执行残留清理，避免 Scripts 目录堆积垃圾文件

### 🔧 技术改进

- ✅ 支持跨平台（Windows 专属清理逻辑，非 Windows 直接跳过）
- ✅ 排序清除策略：优先清理 `.conda_trash` 标记文件，再清理普通 `.c~` 残留
- ✅ 添加完善的单测覆盖（`test/setup-service.test.js`）

---

## v2.7.0 - 首次运行初始化向导与 Miniconda 无损升级 (2026-06-18)

### 🚀 新增功能

#### 首次运行初始化向导（First-run Setup）
- ✅ 新增「初始化配置」导航面板，一键完成新电脑 Python 环境搭建
- ✅ 自动检测现有 Conda，缺失时静默下载安装最新版 Miniconda
- ✅ 安装路径自定义配置，自动推荐默认安装目录
- ✅ Conda / pip 分组包目录展示，支持多选预装包
- ✅ 初始化任务可视化进度条，分阶段展示（检测 → 下载 → 解析依赖 → 创建环境 → 安装包 → 完成）
- ✅ 操作弹窗实时显示安装输出日志，完成后自动刷新概览

#### Miniconda 无损升级
- ✅ 新增 Miniconda 维护卡片，展示 Conda 版本、base Python 版本、环境数
- ✅ 一键升级仅更新 base 环境中的 Conda 核心包，不修改已有业务环境
- ✅ 升级前自动导出 base 显式配置，完成后核对所有环境路径
- ✅ 需要管理员权限时给出明确提示，引导用户以管理员身份运行
- ✅ 修复 Windows 上历史 `conda.exe.c~.conda_trash` 残留导致升级收尾失败的问题
- ✅ Conda 核心已更新但临时文件清理报错时，自动清理、恢复并继续核对环境路径

### 🔧 技术改进

#### 后端
- ✅ 新增 `src/services/setup-service.js` — 初始化与 Miniconda 维护服务模块
- ✅ 新增 `GET /api/setup/status` — 返回初始化状态（Conda 检测、平台架构、包目录、推荐安装路径）
- ✅ 新增 `POST /api/setup/tasks` — 启动异步初始化安装任务
- ✅ 新增 `GET /api/setup/tasks/:id` — 轮询任务实时进度与输出日志
- ✅ 新增 `POST /api/setup/miniconda-upgrade` — 启动 Miniconda 无损升级任务
- ✅ 初始化任务支持流式 stdout/stderr 回调，长度控制避免内存堆积
- ✅ 任务状态含 stage、progress、output、message 等完整字段

#### 前端
- ✅ 新增导航按钮「初始化配置」及对应面板 `#panel-setup`
- ✅ 双列布局：左侧安装区域 + 右侧 Miniconda 维护卡片
- ✅ 包选择目录支持「全选/清空」切换按钮
- ✅ 新增 `.setup-layout`、`.setup-facts`、`.setup-progress`、`.setup-steps`、`.setup-console` 等组件样式
- ✅ 初始化状态检测、任务轮询、错误重试完整的生命周期管理

---

## v2.6.6 - Conda 环境克隆增强与 pip 回退安装 (2026-06-16)

### 🚀 新增功能

#### Conda 环境创建支持 pip 回退
- ✅ 当 conda 源无法解析部分包时，自动通过 pip 安装缺失包
- ✅ 支持 conda-forge 源 (`--override-channels`) 下 conda → pip 回退链路
- ✅ 新增 `explicitPackagesOnly` 模式，仅安装显式依赖，跳过克隆包
- ✅ 添加 `ensurepip` 自动引导，确保目标环境有可用 pip

#### Conda 环境导出自定义通道
- ✅ `rewriteExportedEnvironment` 支持重写 YAML 中的 `channels:` 段
- ✅ 创建克隆环境时，按源通道写入正确的 channel 配置

### 🔧 技术改进

#### Python 版本查询支持全量搜索
- ✅ `searchCondaPythonVersions` 在未指定版本时直接查询 conda，不再走缓存
- ✅ 全量搜索结果按大版本分组缓存，提升后续按版本查询效率

#### Conda 命令行参数集中管理
- ✅ 提取 `buildCondaSolveArgs`、`buildCondaSearchArgs`、`buildCondaEnvCreateArgs` 等构建函数
- ✅ 统一 `--solver classic --no-default-packages` 参数，消除重复

#### 创建环境表单体验优化
- ✅ 指定大版本时只显示对应小版本；未指定时展示全部缓存版本
- ✅ 缓存为空时 fallback 到已知大版本列表
- ✅ 无缓存时自动在线查询，不再保持沉默
- ✅ Conda 源切换时自动重新加载版本列表
- ✅ 克隆包但不克隆 Python 时，日志中记录目标 Python 版本

### 🐛 Bug 修复

#### Conda 包名解析兼容性
- ✅ `parseMissingCondaPackages` 正确解析 `PackagesNotFoundError` 块中的包名
- ✅ `condaSpecToPipSpec` 支持 conda 精确匹配 (`pkg=ver`) 和构建号匹配 (`pkg=ver=build`) 两种格式
- ✅ pip 回退时自动排除 `pip`、`setuptools`、`wheel` 等引导包

## v2.6.5 - 修复切换 Conda 源时版本下拉消失 (2026-06-17)

### 🐛 Bug 修复

#### 创建环境表单切换 Conda 源时版本下拉不消失
- ✅ 切换 Conda 源时，若新通道无缓存数据，不再清空已有版本下拉选项
- ✅ 保留当前选项直到用户主动刷新或查询

## v2.6.4 - 修复 Conda 环境删除残留目录 (2026-06-17)

### 🐛 Bug 修复

#### Conda 环境删除残留目录
- ✅ 修复 `conda env remove` 成功但残留空目录时，首次删除不清理的问题
- ✅ 现在 conda 命令成功后仍检查目录是否存在，存在则强制清理
- ✅ 不再需要删第二次

## v2.6.3 - Conda 版本缓存独立计时 (2026-06-17)

### 🔧 技术改进

#### Conda 版本缓存各自独立计时
- ✅ defaults 和 conda-forge 通道的缓存条目各自记录独立的时间戳
- ✅ 刷新任一通道不再影响另一通道的缓存有效期
- ✅ 底层缓存结构改为每通道+大版本对存储 { versions, updatedAt }

## v2.6.2 - 新增 Conda 版本缓存与创建表单小版本选择 (2026-06-17)

### 🚀 新增功能

#### Conda Python 版本本地缓存
- ✅ 自动缓存 `conda search` 结果到 `~/.weipython/cache/conda-python-versions.json`
- ✅ 缓存有效期 1 小时，命中后直接返回，避免重复查询
- ✅ 「Python 版本」页面优先展示缓存数据，标注「（缓存）」
- ✅ 刷新按钮调用强制刷新端点，更新缓存

#### 创建环境支持选择小版本与 Conda 源
- ✅ 「按 Python 版本创建」的版本下拉改为动态加载缓存的完整小版本号
- ✅ 「基于已有环境创建」的目标版本下拉同样从缓存加载
- ✅ 两种模式均新增 Conda 源选择器（defaults / conda-forge）
- ✅ 选择 conda-forge 源时自动追加 `-c conda-forge` 参数
- ✅ 创建表单新增 ↻ 刷新按钮，一键刷新全部大版本缓存

### 🔧 技术改进

#### 后端
- ✅ 新增 `getCondaPythonVersionsCache()` 返回完整缓存
- ✅ 新增 `refreshCondaPythonVersions(version, channel, root)` 强制刷新
- ✅ `searchCondaPythonVersions` 改为缓存优先策略
- ✅ `createCondaEnvironment` 新增 channel 参数支持

#### API
- ✅ `GET /api/conda/python-versions/cache` — 获取缓存
- ✅ `POST /api/conda/python-versions/refresh` — 强制刷新

## v2.6.1 - 新增 Conda Python 版本查询与 conda-forge 源支持 (2026-06-17)

### 🚀 新增功能

#### Conda 可用 Python 版本查询
- ✅ 新增独立的「Python 版本」页面，在左侧导航栏「Conda」和「虚拟环境」之间
- ✅ 无需一次查完：先展示已知大版本芯片（3.14 ~ 3.9），点击后再按需查询
- ✅ 显示完整小版本/构建号（如 `3.14.0b1`、`3.14.0a5`），而非仅主版本号

#### conda-forge 源支持
- ✅ 版本查询页面新增 `defaults` / `conda-forge` 源切换
- ✅ 切换到 conda-forge 后自动追加 `-c conda-forge` 参数执行查询
- ✅ 详情卡片标题同步显示当前源名称

### 🔧 技术改进

#### 后端
- ✅ `searchCondaPythonVersions(version, channel, root)` 新增 channel 参数
- ✅ `GET /api/conda/python-versions` 新增 `?version=` 和 `?channel=` 查询参数

#### 前端
- ✅ 版本查询改为两步交互：选大版本 → 查小版本，启动时零远程请求

## v2.6.0 - 豆蔻少女版 UI 改版 (2026-05-30)

- 完整界面重构为豆蔻少女版主题（樱粉奶油风、玻璃拟态、花瓣粒子）
- 修复 Windows 下 npm 版本检测失败问题

## v2.5.2 - 修复 Conda 环境读取过慢 (2026-05-17)

### 🐛 Bug 修复

- ✅ **Python 版本检测并行化**：将 `listCondaEnvironments` 中串行的 `getPythonVersion` 改为 `Promise.all` 批量并行执行，N 个环境耗时从 N×t 降为 1×t
- ✅ **延长超时**：`getSystemOverview` 中 conda 检测超时从 2000ms 提升至 5000ms，避免 conda env list 慢时超时返回空数据
- ✅ **后台刷新兜底**：`loadOverview` 后异步执行 `loadCondaEnvironments`，确保数据最终到达
- ✅ **加载状态提示**：数据到达前展示「正在扫描 Conda 环境...」，避免用户误以为程序卡死

### 📦 本次产物

- 安装包文件名：`WeiPython-Setup-2.5.2.exe`
- 发布类型：Windows NSIS 安装包

---
## v2.5.1 - 启动性能优化 (2026-05-17)

### 🚀 性能优化

- ✅ **并行化系统检测**：`pip --version` / `node --version` / `npm --version` 从串行改为并行执行
- ✅ **消除冗余 API 调用**：启动时从 5 个 HTTP 请求减为 2 个，避免重复获取 Python 版本和 Conda 环境数据
- ✅ **conda 路径缓存**：首次检测 conda 可执行文件后缓存结果，后续调用不再重复扫描
- ✅ **`pip` 超时保护**：为 `pip --version` 添加 3000ms 超时，防止卡死启动流程
- ✅ **懒加载已安装包**：包列表延迟到首次切换到"包管理"面板时加载，加速首屏展示

### 📦 本次产物

- 安装包文件名：`WeiPython-Setup-2.5.1.exe`
- 发布类型：Windows NSIS 安装包

---
## v2.5.0 - 现代化界面与品牌信息更新 (2026-05-16)

### 🛠 优化调整

#### 界面显示效果
- ✅ 优化整体视觉层级、卡片质感、按钮状态与输入控件显示效果
- ✅ 强化主视觉区版本信息、公司品牌展示与运行时信息识别
- ✅ 调整移动端布局细节，提升窄屏下的可读性和操作稳定性

#### 品牌与打包信息
- ✅ 版本包更新为 `2.5.0`
- ✅ 软件公司 / 开发者展示更新为 `尉缭子科技`
- ✅ 更新安装包文件名为 `WeiPython-Setup-2.5.0.exe`

### 📦 本次产物

- 安装包文件名：`WeiPython-Setup-2.5.0.exe`
- 发布类型：Windows NSIS 安装包

---

## v2.4.0 - 系统 Node.js 升级入口 (2026-05-14)

### 🚀 新增功能

#### Windows 系统 Node.js 升级
- ✅ 在概览页面新增“升级 Node.js”操作入口
- ✅ 支持优先通过 `nvm-windows` 执行 `nvm install latest` 与 `nvm use`
- ✅ 未检测到 nvm 时自动回退到 `winget upgrade --id OpenJS.NodeJS.LTS`

### 🛠 优化调整

#### 运行时信息展示
- ✅ 概览页面新增系统 Node 与 npm 版本展示
- ✅ 升级完成后自动刷新系统运行时信息
- ✅ 右上角运行时标签改为显示系统 Node 版本，避免与 Electron 内置 Node 混淆
- ✅ 明确提示 Electron 内置 Node 与系统 Node.js 的版本边界

### 🔧 技术改进

#### 后端升级接口
- ✅ 新增 `/api/node/upgrade` 接口统一处理 nvm 与 winget 升级流程
- ✅ 增加升级前后版本、执行工具与命令输出反馈
- ✅ 为 Node/npm 探测命令增加超时控制，避免概览刷新长期阻塞

### 📦 本次产物

- 安装包文件名：`WeiPython-Setup-2.4.0.exe`
- 发布类型：Windows NSIS 安装包

---

## v2.3.2 - Conda 清单布局与运行状态提示优化 (2026-04-03)

### 🚀 新增功能

#### 悬浮运行状态提示
- ✅ 新增右上角悬浮 `Runtime Status` 状态条，滚动页面时仍可持续可见
- ✅ 长任务处理中增加高亮脉冲提示，提升创建 Conda 环境等操作的状态感知
- ✅ 任务完成或异常后状态条自动延时收起，减少界面常驻干扰

### 🛠 优化调整

#### Conda 页面清单排版重构
- ✅ 将“已检测到的 Conda 环境”改为更紧凑的书签式卡片展示
- ✅ 环境清单区域增加内部滚动，避免环境数量较多时把页面整体拉得过长
- ✅ Conda 环境路径改为单行摘要展示，保留可读性并降低纵向占用

#### 创建环境反馈增强
- ✅ 创建 Conda 环境时新增更明确的操作进度弹窗
- ✅ 失败状态统一展示为“异常”，避免错误提示被覆盖为“就绪”

### 🔧 技术改进

#### 前端状态与视图逻辑增强
- ✅ 新增运行状态条显隐计时逻辑与忙碌态动画样式
- ✅ Conda 环境列表拆分为专用书签布局样式，避免复用通用列表导致信息展开过多

### 📦 本次产物

- 安装包文件名：`WeiPython-Setup-2.3.2.exe`
- 发布类型：Windows NSIS 安装包

---

## v2.3.1 - 桌面版导出浏览功能修复 (2026-03-27)

### 🐛 修复问题

#### Electron 导出路径选择
- ✅ 修复桌面版中 Conda 环境导出“浏览”点击无反应的问题
- ✅ 修复批量导出目录选择依赖的桌面桥接加载问题
- ✅ 将 preload 脚本切换为更稳妥的 CommonJS 入口，避免桌面环境下注入失败

### 📦 本次产物

- 安装包文件名：`WeiPython-Setup-2.3.1.exe`
- 发布类型：Windows NSIS 安装包

---

## v2.3.0 - Conda 批量导出与导出路径交互修复 (2026-03-27)

### 🚀 新增功能

#### Conda 环境文件批量导出
- ✅ 在 Conda 环境文件导出区域新增“一键导出全部环境”
- ✅ 支持将所有已检测到的 Conda 环境分别导出为独立 YAML 文件
- ✅ 导出文件名自动与环境名称对应，统一保存到所选目录

#### 批量导出目录选择
- ✅ 新增默认批量导出目录生成逻辑
- ✅ 桌面版支持通过系统目录选择器挑选批量导出目录
- ✅ 单环境导出与批量导出共用统一的默认导出目录策略

### 🛠 优化调整

#### 导出路径交互修复
- ✅ 修复单环境导出“浏览”按钮反馈不明显的问题
- ✅ 当桌面桥接不可用时，明确弹窗提示并自动回退到默认路径填充
- ✅ 取消保存/目录选择时显示即时状态反馈

### 🔧 技术改进

#### Electron 桥接增强
- ✅ preload 新增桌面环境识别接口
- ✅ 新增 Conda 批量导出目录选择 IPC 通道

#### 后端导出能力扩展
- ✅ 新增批量导出 API，逐个调用 conda 导出并按环境名落盘
- ✅ 新增默认导出目录查询接口

### 📦 本次产物

- 安装包文件名：`WeiPython-Setup-2.3.0.exe`
- 发布类型：Windows NSIS 安装包

---

## v2.2.0 - 工程控制台布局升级与 Conda 导出体验增强 (2026-03-27)

### 🚀 新增功能

#### Conda 环境导出路径增强
- ✅ 导出环境文件时支持根据当前环境名自动生成默认路径
- ✅ 默认导出路径统一落在 `Documents\WeiPython\exports\<环境名>.yml`
- ✅ 桌面版新增“浏览”按钮，可直接调用系统保存对话框选择导出位置

#### Electron 桌面桥接能力
- ✅ 新增 preload 通道，为环境导出提供安全的保存路径选择能力
- ✅ 保持网页模式兼容，在非桌面模式下仍可自动填充默认导出路径

### 🛠 优化调整

#### 专业控制台式界面重构
- ✅ 重新组织整体布局，强化“主操作区 + 次要信息折叠区”的工程软件结构
- ✅ 将高频任务前置，创建环境、包管理和输出结果获得更大可视区域
- ✅ 导入、导出、环境清单、requirements 等低频操作改为折叠展开，降低视觉噪音

#### 视觉层级与交互密度优化
- ✅ 统一界面为更克制的工程控制台风格，弱化装饰，强调状态、输出和执行路径
- ✅ 优化面板层级、按钮主次、表单分组和卡片尺寸分配
- ✅ 改进移动端和窄屏布局，折叠区与主操作区在单列模式下保持清晰结构

### 🔧 技术改进

#### 前后端导出逻辑统一
- ✅ 后端导出接口支持在未传文件路径时自动生成安全默认值
- ✅ 新增默认导出路径查询接口，前端可与当前所选 Conda 环境联动
- ✅ 文件名会自动清洗非法字符，减少 Windows 路径报错

### 📦 本次产物

- 安装包文件名：`WeiPython-Setup-2.2.0.exe`
- 发布类型：Windows NSIS 安装包

---

## v2.1.10 - 品牌信息统一与安装器本地化优化 (2026-03-26)

### 🚀 新增功能

#### 安装器快捷方式本地化
- ✅ 英文安装环境下桌面和开始菜单快捷方式显示 `WeiPython Manager`
- ✅ 中文安装环境下桌面和开始菜单快捷方式显示 `尉Python 环境管理器`
- ✅ 卸载时自动清理中英文两套快捷方式名称，避免残留旧图标

### 🛠 优化调整

#### 品牌与关于信息统一
- ✅ 软件名称统一为 `WeiPython Manager / 尉Python 环境管理器`
- ✅ About 窗口补充中英文软件简介、核心定位、版本说明与开发者信息
- ✅ 首页品牌标题与核心定位文案同步更新

#### Windows 打包元数据
- ✅ 更新 Product Name 为 `WeiPython Manager`
- ✅ 更新 File Description 为 `Python Environment Management Tool`
- ✅ 更新 Company / Copyright 展示信息为 `Ethan Wilkins`
- ✅ 默认安装目录更新为 `D:\Program Files\WeiPython Manager`

### 📦 本次产物

- 安装包文件名：`WeiPython-Setup-2.1.10.exe`
- 发布类型：Windows NSIS 安装包

---

## v2.1.9 - 包安装过程可视化与操作反馈增强 (2026-03-24)

### 🚀 新增功能

#### 包管理安装过程弹窗
- ✅ 在“包管理”页面执行安装或升级时，弹出独立过程窗口
- ✅ 实时显示 `pip install` / `pip install --upgrade` 输出日志
- ✅ 自动滚动到最新输出，便于观察下载、解析、安装进度

#### 后端安装任务跟踪
- ✅ 新增包安装任务机制，为安装过程生成任务 ID
- ✅ 支持前端轮询安装状态、过程日志和最终结果
- ✅ 对安装超时、执行异常和 stderr 输出提供统一回传

### 🐛 修复问题

#### 包管理体验
- ✅ 修复包安装过程中只能在结束后看到结果的问题
- ✅ 安装失败时在弹窗内直接显示失败原因和完整过程输出
- ✅ 安装完成后自动刷新已安装包下拉列表

#### 界面反馈
- ✅ 扩大操作过程弹窗尺寸，适配长日志阅读
- ✅ 增强结果面板与过程弹窗的一致性，完成后保留完整输出

### 🔧 技术改进

#### 执行层
- ✅ 为命令执行工具新增流式 stdout/stderr 回调能力
- ✅ 安装日志增加长度控制，避免长时间任务占用过多内存
- ✅ 增加安装任务过期清理，防止内存中的任务状态长期堆积

### 📦 本次产物

- 安装包文件名：`WeiPython-Setup-2.1.9.exe`
- 发布类型：Windows NSIS 安装包

---

## v1.1.0 - Python 3.14 支持 (2025-12-10)

### 🚀 新增功能

#### Python 3.14 完整支持
- ✅ 添加 Python 3.14.2, 3.14.1, 3.14.0 到下载列表
- ✅ Miniconda 添加 Python 3.14 支持 (Miniconda3-py314_24.9.0-0)
- ✅ Conda 环境创建支持 Python 3.14
- ✅ Windows 路径检测支持 C:\Python314
- ✅ Linux/macOS 路径检测支持 /usr/bin/python3.14

#### Python 3.13 最新版本
- ✅ 添加 Python 3.13.11, 3.13.10, 3.13.9 到下载列表
- ✅ 更新 Conda 环境创建默认版本为 3.13

### 🐛 修复问题

#### Conda 环境管理
- ✅ 修复 conda 环境检测问题，现在能正确显示所有环境
- ✅ 修复 conda 环境创建功能，实际执行创建命令
- ✅ 修复 conda 环境删除功能，实际执行删除命令
- ✅ 添加环境创建/删除的错误处理

#### 包管理功能
- ✅ 修复包信息显示，使用真实的 `pip show` 命令
- ✅ 改进包列表显示格式：`包名 (版本)`
- ✅ 修复包名解析逻辑，支持多种格式
- ✅ 增大包信息窗口尺寸 (700x500)
- ✅ 实际的包安装/卸载/升级功能

#### Python 版本检测
- ✅ 扩展检测路径，包括：
  - `C:\Program Files\Python3XX`
  - `C:\Program Files (x86)\Python3XX`
  - `PATH` 环境变量中的 Python
  - pyenv/asdf 版本管理器支持
- ✅ 添加版本去重和排序
- ✅ 改进版本检测失败的错误提示

### 🔧 技术改进

#### 模块化架构
- ✅ 分离环境管理逻辑到 `environment_manager.py`
- ✅ 分离 Miniconda 安装逻辑到 `miniconda_installer.py`
- ✅ 主程序专注 UI 逻辑，提高可维护性

#### 错误处理
- ✅ 完善的异常处理机制
- ✅ 用户友好的错误提示
- ✅ 操作失败时的详细反馈

#### 跨平台支持
- ✅ Windows、Linux、macOS 全平台支持
- ✅ 自动平台检测和路径适配
- ✅ 不同平台的可执行文件路径处理

### 📋 测试结果

```
✅ Conda 环境检测：成功检测到 7 个环境
   - miniconda3 (Python 3.13.5)
   - fenv (Python 3.13.1) 
   - py314 (Python 3.14.0) ⭐
   - pyBIyo_env (Python 3.11.13)
   - python3131 (Python 3.13.1)
   - vacuum_env (Python 3.11.13)

✅ Python 版本检测：支持 3.9-3.14 全系列
✅ 包管理功能：真实操作和详细显示
✅ UI 界面：所有标签页功能正常
```

### 🎯 用户影响

#### 对现有用户
- 所有 Conda 环境现在都能正确显示
- 包管理功能可以实际安装/卸载包
- Python 版本检测更加全面

#### 对新用户
- 支持 Python 3.14 最新版本
- 更完整的 Python 版本选择
- 更好的错误提示和用户体验

### 📁 文件变更

#### 新增文件
- `environment_manager.py` - 环境管理核心模块
- `miniconda_installer.py` - Miniconda 安装模块
- `test_conda_detection.py` - Conda 检测测试工具
- `BUG_FIXES.md` - Bug 修复说明
- `CHANGELOG.md` - 更新日志 (本文件)

#### 修改文件
- `python_manager.py` - 主程序，大量功能更新
- `requirements.txt` - 依赖说明
- `README.md` - 使用文档更新

### 🔄 版本兼容性

#### Python 版本支持
- ✅ Python 3.9.x (支持到 3.9.19)
- ✅ Python 3.10.x (支持到 3.10.15)
- ✅ Python 3.11.x (支持到 3.11.11)
- ✅ Python 3.12.x (支持到 3.12.8)
- ✅ Python 3.13.x (支持到 3.13.11) ⭐
- ✅ Python 3.14.x (支持到 3.14.2) ⭐

#### 平台支持
- ✅ Windows 10/11 (x64, x86)
- ✅ macOS (Intel, Apple Silicon)
- ✅ Linux (主流发行版)

### 🚀 已知问题和限制

#### 当前限制
1. Miniconda 下载需要网络连接
2. 某些包管理操作可能需要管理员权限
3. 虚拟环境创建需要 Python 3.7+

#### 计划修复
- [ ] 添加下载进度显示
- [ ] 支持更多 Python 版本管理工具
- [ ] 添加环境导出/导入功能
- [ ] 支持批量包操作
- [ ] 添加配置文件编辑功能

### 🎉 升级建议

1. **立即升级**：支持 Python 3.14 最新特性
2. **检查环境**：使用新的测试工具验证 conda 检测
3. **更新配置**：确保程序能找到所有 Python 版本
4. **体验新功能**：尝试改进的包管理功能

---

## v1.0.0 - 初始版本 (2025-12-10)

### 🎉 首次发布
- 基础的 Python 和 Miniconda 环境管理功能
- 图形界面操作
- 虚拟环境支持
- 包管理基础功能

---

*更新日志按时间倒序排列，最新版本在顶部*
