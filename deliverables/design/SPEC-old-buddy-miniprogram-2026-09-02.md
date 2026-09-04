# 老友时光 · 小程序产品设计规格（SPECDOC）

> 生成：2026-09-02 ｜ 基于 MVP 开发专家团调研（设计师 + 架构师）｜ 状态：原型已跑通
> 定位：面向 50–60 岁城市退休族（帮子女带孙子、白天有大段空闲）的微信小程序。
> 核心价值：AI 自动聚合上海全市社区/文化/老年教育活动，用户按手机定位看到"附近 1km（可切 1/3/5/10km）本周有啥"。

---

## 1. 设计系统（Design Tokens）

**配色（深青 #0F766E / 暖橙 #EA580C，基于 ui-ux-pro-max「Accessible & Ethical」+ color 域「Caring teal + warm orange」检索结论，2026-09-02 重设计）**
| Token | 值 | 用途 |
|---|---|---|
| `--c-primary` 深青 | `#0F766E` | 主色（对白 7:1+），用于主按钮、Tab 选中、顶栏、图标 |
| `--c-primary-600` | `#0D9488` | 次级青，图标/强调 |
| `--c-primary-50` | `#F0FDFA` | 青色淡底，激活/悬停/图标圆底 |
| `--c-accent` 暖橙 | `#EA580C` | 行动色（长波暖色，老年人辨色友好）；报名 CTA、收藏激活、焦点环 |
| `--c-bg` | `#F4F6F5` | 页面底（暖中性，规避纯白眩光） |
| `--c-surface` | `#FFFFFF` | 卡片/弹层 |
| `--c-text` | `#1F2933` | 主文字（白底 7:1） |
| `--c-text-2` | `#475569` | 次要文字（7:1） |
| `--c-text-3` | `#64748B` | 辅助说明（仅非关键） |
| `--c-border` | `#E5E9EC` | 描边 |
| `--c-free` | `#047857` | "免费"语义色 |
| `--c-warn` | `#B45309` | 防诈骗提示文字（琥珀） |

**字号（一律 px，禁 rpx；适老化底线）**
- 基础 `--font-base: 18px`；大字模式 `--font-base: 22px`（根节点 `data-size="lg"` 切换，纯 CSS 零成本）
- 标题 20–23px；正文 16–18px；次要 ≥13px

**间距 / 圆角 / 触控**
- 圆角 14px；卡片细边框 + 轻阴影
- **触控区主操作 56px，次级 48px**（原生 Tab 默认仅 ~10px 文字且不可调，故微信原生版须用 custom-tab-bar）
- 语义色**不单独承载信息**：任何状态必 `图标 + 文字 + 颜色` 三重编码

**图标系统（P0：禁 emoji，锁 Lucide 内联 SVG）**
- 全站零 emoji；图标统一描边、可矢量缩放，尺寸 20/24/28（设计师建议上移自 P0 基线 16/20/24，已声明理由）
- 语义映射：附近=home / 分类=grid / 收藏=bookmark / 我的=user / 定位=map-pin / 时间=clock / 导航=navigation / 语音=volume / 大字=type / 防骗=shield / 分享=share 等
- 移植微信原生：从同一 Lucide 字形导出 81×81 @2x/@3x PNG 入 `assets/tabbar/`

---

## 2. 产品页面结构（完整小程序，非单页）

| 页面 | 路由 | 核心内容 |
|---|---|---|
| **附近（首页）** | `#/home` | 顶栏：定位按钮 + 半径分段控件(1/3/5/10km，带各半径场次计数) + 分类快速九宫格；视图：附近活动卡片流（按距离排序） |
| **活动详情** | `#/detail/:id` | 类型标签 + 标题 + 时间/地点(带一键导航) + 费用 + 溯源 + 描述 + 我要报名(防诈骗确认) + 收藏 + 语音播报；无底部 Tab |
| **分类浏览** | `#/category` | 分类 chips（各分类在半径内计数）+ 列表（**仍受当前半径约束**） |
| **我的收藏** | `#/favorites` | 本地收藏列表（无账号，localStorage） |
| **我的** | `#/me` | 账号卡 + 菜单：收藏 / 大字模式开关 / 语音播报开关 / 定位授权 / 防骗须知 / 关于 |

**定位是贯穿全产品的筛选主轴**：首页按半径拉取 → 详情看单条 → 分类页按 type 过滤（仍受半径约束）→ 收藏本地。

---

## 3. 架构与接口契约

**后端（已运行 `server.py`，本机 `http://127.0.0.1:8788`）**
- `GET /nearby?lat&lng&radius` → `{radius, count, nearby:[Activity]}`（半径 1/3/5/10km）
- `GET /refresh` → 触发采集，回报数据源溯源（live/seed、geo_source）
- `GET /` 与 `/static/*` → 托管小程序前端

**Activity 字段**：`id, title, type, venue, address, time, fee, signup, lat, lng, distance_km, source, geo_source`

**全局状态（前端 store，localStorage 持久化）**
- `location{lat,lng,name,authorized}`（默认关闭，用时授权）
- `radius`（默认 1，持久化）
- `favorites[]`（本地，持久化）
- `settings{largeFont, voice}`（持久化）

**落地形态**：当前为移动端 Web 原型（HTML/CSS/JS SPA，1:1 映射微信原生），接 `/nearby` 跑通主链路；后续语法平移为 WXML/WXSS/Page。

**防诈骗闭环（5 点）**：① 报名外跳前确认弹层显示**真实域名**（等宽字体）；② 溯源条吃 `source/geo_source`（seed 降级为"未核实"）；③ 费用明示 + "old-buddy 不代收费用"；④ 首页每 N 张插常驻教育条；⑤ 举报通路（规划）。

---

## 4. 已知门槛 / 下一步
- **真实数据接入三件套**：上海开放数据实名认证 app key + 高德/腾讯地理编码 key + 建议国内部署（规避 WAF 412 与限流）。填 key 后管道零改动切 live。
- **语音播报**：Web 原型用 `SpeechSynthesis`(zh-CN)；微信原生无内建 TTS，需服务端预生成音频或接插件（建议服务端补 `tts_text` 字段）。
- **微信原生移植**：custom-tab-bar 替代原生 Tab（字号/图标可控）；`tts_text` 依赖服务端。
