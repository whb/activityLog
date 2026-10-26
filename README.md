# ActivityLog · 运动数据分析（Web 版）

复刻 [ActivityLog2](https://github.com/alex-hhh/ActivityLog2) 的核心功能：导入游泳、骑行、跑步等运动的 `.FIT` 训练文件，展示轨迹、图表、地图与报告趋势，并追踪装备使用情况。原项目为 Racket 桌面应用，本仓库改写为纯 Web 技术栈。

## 功能

- 📥 **FIT 文件导入**：支持 Garmin / Polar / Suunto 等设备的 `.fit` 文件，批量导入，数据存入本地 SQLite。
- 📊 **仪表盘**：总里程 / 总时长 / 活动数等概览，月度里程构成（按运动类型堆叠）、运动时长趋势、里程占比、各类型累计。
- 🏃 **活动列表**：按运动类型、日期区间、关键词筛选，支持删除。
- 📈 **活动详情**：海拔 / 距离 / 速度 / 心率 / 功率 / 踏频 / 温度等时序图表（ECharts），轨迹地图（Leaflet + OpenStreetMap），关键指标卡片。
- 🔧 **装备**：自动识别 FIT 中的设备信息，累计每台设备使用时长与关联活动数。

## 技术栈

| 层 | 选型 | 版本 |
| --- | --- | --- |
| 运行时 | Node.js（内置 `node:sqlite`，免原生编译） | 22.x LTS |
| 后端 | Express | 4.x |
| 数据库 | SQLite（`node:sqlite`） | 内置 |
| 前端 | React + Vite | 19 / 7 |
| 图表 | ECharts | 6 |
| 地图 | Leaflet | 1.9 |
| FIT 解析 | `fit-file-parser` | 6 |

> 选用 Node 内置 `node:sqlite` 是为了在纯国内镜像环境下免原生模块编译，安装零障碍。

## 目录结构

```
├─ client/            # React 前端
│  ├─ pages/          # 仪表盘 / 活动列表 / 详情 / 装备 / 导入
│  ├─ components/     # ECharts、Leaflet 封装
│  ├─ lib/format.js   # 运动元数据与格式化
│  ├─ App.jsx         # 布局与路由
│  ├─ api.js          # 后端接口封装
│  └─ styles.css
├─ server/
│  ├─ index.js        # Express 服务 + REST API + 生产静态托管
│  ├─ fit.js          # FIT 解析 → 规范化活动 + 记录点
│  ├─ db.js           # SQLite 建表
│  └─ seed.js         # 演示数据
├─ scripts/           # JSDOM 渲染冒烟测试
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

### 前端渲染冒烟测试

```bash
npm run smoke    # 用 JSDOM + 打桩的 echarts/leaflet/fetch 真实渲染 5 个页面
```

## 配置国内镜像

本仓库开发已使用 `https://registry.npmmirror.com`。如需在新机器上配置：

```bash
npm config set registry https://registry.npmmirror.com
```

## REST API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/import` | 上传 `.fit`（表单字段 `file`），解析入库 |
| `GET` | `/api/activities?sport=&from=&to=&q=` | 活动列表（可筛选） |
| `GET` | `/api/activities/sports` | 已存在的运动类型 |
| `GET` | `/api/activities/:id` | 活动详情 + 全部记录点 |
| `DELETE` | `/api/activities/:id` | 删除活动及其记录 |
| `GET` | `/api/reports/summary` | 概览 / 月度 / 各类型累计 |
| `GET` | `/api/equipment` | 装备列表与使用时长 |

## 说明与限制

- 数据全部保存在本地 `data/activitylog.db`，不上传任何服务器。
- 地图瓦片来自 OpenStreetMap，国内访问速度视网络而定。
- 演示数据（`npm run seed`）会在活动名称前带有真实运动特征，可随时在「活动记录」中删除。
