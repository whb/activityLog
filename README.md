# ActivityLog · 运动数据分析（Web 版）

复刻 [ActivityLog2](https://github.com/alex-hhh/ActivityLog2) 的核心功能：导入游泳、骑行、跑步等运动的 `.FIT` 训练文件，展示轨迹、图表、地图与报告趋势，并追踪装备使用情况。原项目为 Racket 桌面应用，本仓库改写为纯 Web 技术栈。

## 功能

- 📥 **FIT 文件导入**：支持 Garmin / Polar / Suunto 等设备的 `.fit` 文件，批量导入，数据存入本地 SQLite。多运动（铁三）文件自动聚合为全程记录。
- 📊 **仪表盘**：总里程 / 总时长 / 活动数等概览，月度里程构成（按运动类型堆叠）、运动时长趋势、里程占比、各类型累计。
- 🚦 **训练状态（Traffic Light）+ PMC 训练负荷**：按 Banister TRIMP 计算每日负荷，指数加权得到 ATL（急性）/ CTL（慢性体能）/ TSB（状态），并以红绿灯给出"过度疲劳 / 偏累 / 竞技状态 / 恢复良好"建议。
- 🔥 **训练热力图**：① 星期 × 小时时段热力图；② 日历热力图（最近 12 个月每日里程，贡献图风格）。
- 🏃 **活动列表**：按运动类型、日期区间、关键词筛选，支持删除。
- 🎯 **联动图表（Laps × Map × Elevation）**：复刻 ActivityLog2「Charts」页——左侧圈速表、右侧交互地图、底部海拔剖面三者**联动**：在海拔曲线悬停/点击、点击地图任意处、或选中某圈，地图当前位置标记与信息面板（时刻/速度/海拔/距离/心率/功率/速度小曲线）同步更新；支持"缩放至圈 / 仅显示所选圈 / 轨迹定位点 / 适应窗口"。
- 📈 **活动详情时序图**：海拔 / 距离 / 速度 / 心率 / 功率 / 踏频 / 温度（ECharts）+ 关键指标卡片。
- ⚙️ **功率分析（Aerolab 风格）**：归一化功率 NP、强度因子 IF、TSS、功率曲线（1s/5s/1min/5min/20min）、Z1–Z5 分区时间分布、功率尖峰（Power Spikes）表。
- ⛰️ **爬升分析（Climb Analysis）**：自动检测爬升段，列出长度 / 爬升 / 平均坡度 / 最大坡度 / 累积坡度。
- 📊 **散点图 & 直方图**：心率×速度、功率×速度散点；速度分布、心率分布直方图。
- 🏊 **游泳指标**：配速（/100m）、距离、平均心率等（SWOLF 需划次数据，采集到后自动展示）。
- 🏆 **会话进阶分析**：均值最大图（Best Avg，多时长窗口最佳均值）、象限图（心率×功率/速度 + 均值参考线四象限）、有氧解耦（Aerobic Decoupling，后半程 HR 相对功率漂移）、间隔检测（自动识别重复努力段）。
- 📈 **趋势分析（Trends）**：复刻 ActivityLog2「Trends」——性能（PMC）、训练量（按运动堆叠 + 时长双轴）、区间时间（Time in Zone Z1–Z5）、有氧效率（每单位心率产出指数化）、受伤风险（ACWR 急性:慢性负荷比，含绿区标记）。
- 📑 **报表（Reports）**：按月聚合（次数/时长/里程/均心率/均踏频/爬升/均功率），支持按运动筛选，可导出 CSV 并查看底层 SQL。
- 📅 **日历（Calendar）**：月历视图，按日显示训练分布，点选日期查看当日活动并跳转详情。
- 🧑 **运动员指标（Athlete）**：随时间记录体重 / 静息HR / 最大HR / LTHR / FTP，趋势折线图 + 记录管理。
- 📝 **训练计划（Workouts）**：创建/管理训练结构（热身/间隔/恢复/冷却，含时长与目标值），步骤以 JSON 存储。
- 🔧 **装备**：自动识别 FIT 中的设备信息，累计每台设备使用时长与关联活动数。
- ⬇️ **导出**：活动/记录/圈速 CSV（UTF-8 带 BOM，Excel 兼容）、任意 ECharts 图表导出 PNG。

## 技术栈

| 层 | 选型 | 版本 |
| --- | --- | --- |
| 运行时 | Node.js（内置 `node:sqlite`，免原生编译） | 22.x LTS |
| 后端 | Express | 4.x |
| 数据库 | SQLite（`node:sqlite`） | 内置 |
| 前端 | React + Vite | 19 / 7 |
| 图表 | ECharts | 6 |
| 地图 | 高德地图（AMap JS API v2），无 Key 时回退 Leaflet + OSM | AMap v2 / 1.9 |
| FIT 解析 | `fit-file-parser` | 6 |

> 选用 Node 内置 `node:sqlite` 是为了在纯国内镜像环境下免原生模块编译，安装零障碍。

## 目录结构

```
├─ client/            # React 前端
│  ├─ pages/          # 仪表盘 / 趋势 / 报表 / 日历 / 活动列表 / 详情 / 运动员 / 训练计划 / 装备 / 导入
│  ├─ components/     # ECharts、Leaflet 封装
│  ├─ lib/format.js   # 运动元数据与格式化
│  ├─ App.jsx         # 布局与路由
│  ├─ api.js          # 后端接口封装
│  └─ styles.css
├─ server/
│  ├─ index.js        # Express 服务 + REST API + 生产静态托管
│  ├─ fit.js          # FIT 解析 → 规范化活动 + 记录点（含多运动/设备识别）
│  ├─ importer.js     # 共享入库逻辑（API 与 seed 复用，保证一致）
│  ├─ db.js           # SQLite 建表
│  ├─ seed.js         # 合成演示数据
│  └─ seed-fit.js     # 导入真实 ActivityLog2 测试 .FIT
├─ scripts/           # JSDOM 渲染冒烟测试 / 下载测试数据
├─ data/              # SQLite 数据库（运行期生成，已忽略）
├─ index.html
├─ vite.config.js
└─ package.json
```

## 快速开始

```bash
# 1. 安装依赖（已使用国内镜像）
npm install

# 2.（可选）载入演示数据，便于先查看界面
npm run seed

# 3. 启动开发（后端 :3001 + 前端 :5173，前端已配置 /api 代理）
npm run dev
```

浏览器打开 http://localhost:5173 。

### 生产构建

```bash
npm run build    # 输出 dist/
npm start        # 以生产模式启动，Express 同时托管 dist 与 API（:3001）
```

访问 http://localhost:3001 。

### 载入真实测试数据（ActivityLog2 官方 .FIT）

用上游 [ActivityLog2 仓库](https://github.com/alex-hhh/ActivityLog2/tree/master/test/test-data)的 9 个真实
Garmin / Cydynamics `.FIT` 文件生成 demo（3 骑行 / 2 跑步 / 3 游泳 / 1 铁三，共约 168km，含真实 GPS 轨迹）。
`.FIT` 存于 `data/import/`（已 gitignore，按需下载）：

```bash
node scripts/download-test-data.js   # 从 GitHub API 下载 9 个 .FIT 到 data/import/
npm run seed:fit                     # 解析并全部入库（已有数据会跳过）
npm run seed:fit -- --force          # 清空现有数据后重新导入
npm run gen:demo                     # 把库里数据同步到内置示例 client/lib/demoData.js
```

> `gen:demo` 让「无后端的纯静态预览」也显示与后端一致的真实数据（`demoData.js` 为生成物）。

> 说明：多运动文件（如铁三）会按 `auto_multi_sport` 正确聚合全程距离/时长并归类为 `triathlon`；
> 设备从 `device_infos` 的 creator 记录解析出真实产品名（如 Forerunner 920 XT）。
> 轨迹坐标多为澳大利亚（珀斯），位于中国境外，GCJ-02 偏移换算会自动跳过，地图按原始 WGS-84 显示。

### 前端渲染冒烟测试

```bash
npm run smoke    # 用 JSDOM + 打桩的 echarts/leaflet/fetch 真实渲染 5 个页面
```

## 配置国内镜像

本仓库开发已使用 `https://registry.npmmirror.com`。如需在新机器上配置：

```bash
npm config set registry https://registry.npmmirror.com
```

## 地图配置（高德地图）

轨迹地图按**坐标位置智能路由**，保证国内外轨迹都能显示：

- **国内轨迹**：若 `.env` 配置了 `amap_key`，使用**高德地图（AMap JS API v2）**（GCJ-02 坐标，交互/缩放控件更完善）；Key 失效时自动降级。
- **境外轨迹**（如澳洲、欧洲）：高德对其无底图数据，直接使用 **ArcGIS 世界街道图瓦片**（Leaflet，WGS-84 坐标，无需 Key、全球覆盖、国内可达）。
- **无 Key**：全部使用 ArcGIS 世界瓦片，功能不受影响。

```bash
# 1. 复制示例配置
cp .env.example .env

# 2. 填入你的高德 Key（仅用于国内轨迹，可留空）
#    amap_key=你的高德key
#    amap_security_code=你的安全密钥   # 若控制台要求
```

- 在 [高德开放平台控制台](https://console.amap.com/dev/key/app) 创建应用 → 添加 Key，类型选 **Web端(JS API)**，域名白名单可加 `localhost`（或留空不限制）。
- 服务启动时通过 `--env-file-if-exists=.env` 自动加载（`dev:server` / `start` 脚本已内置）。
- 后端经 `GET /api/config` 把 Key 下发给前端，前端据此动态加载高德 JS API 并绘制轨迹。
- 坐标自动做 WGS-84 ↔ GCJ-02 换算（仅国内生效），避免轨迹偏移。

## REST API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/import` | 上传 `.fit`（表单字段 `file`），解析入库 |
| `GET` | `/api/activities?sport=&from=&to=&q=` | 活动列表（可筛选） |
| `GET` | `/api/activities/sports` | 已存在的运动类型 |
| `GET` | `/api/activities/:id` | 活动详情 + 全部记录点 + 圈速(laps) |
| `DELETE` | `/api/activities/:id` | 删除活动及其记录 |
| `GET` | `/api/reports/summary` | 概览 / 月度 / 各类型累计 |
| `GET` | `/api/reports/monthly?sport=` | 按月聚合报表 + 底层 SQL |
| `GET` | `/api/athlete-metrics` | 运动员指标列表 |
| `POST` | `/api/athlete-metrics` | 新增指标（recorded_at 必填） |
| `DELETE` | `/api/athlete-metrics/:id` | 删除指标 |
| `GET` | `/api/workouts` | 训练计划列表（steps 已解析） |
| `POST` | `/api/workouts` | 新建训练计划 |
| `DELETE` | `/api/workouts/:id` | 删除训练计划 |
| `GET` | `/api/equipment` | 装备列表与使用时长 |

## 说明与限制

- 数据全部保存在本地 `data/activitylog.db`，不上传任何服务器。
- 轨迹地图默认走高德（需在 `.env` 配置 `amap_key`）；未配置时回退 OpenStreetMap。高德 Key 属前端可见的 JS API Key，建议在高德控制台为其绑定域名/配额做限制。
- 演示数据（`npm run seed`）会在活动名称前带有真实运动特征，可随时在「活动记录」中删除。
