# 老友时光 · v2 设计 + 架构规格（2026-09-03）

> 在 v1（裸页面 + 紫色失败稿）基础上，按「小程达」专家工作流重做：UI 重新设计、架构彻底分层、可直接看到内容。

## 一、设计系统（暖米底 · 深青 · 暖橙）

| Token | 值 | 用途 |
|---|---|---|
| 底色 `--bg` | `#F4EFE4` | 暖米纸底，规避纯白眩光 |
| 主色 `--primary` | `#0E6E6E` | 深青：导航、主按钮、激活态（高对比、长者辨色友好） |
| 强调 `--accent` | `#E8743B` | 暖橙：CTA、紧急报名、收费语义 |
| 文字 `--ink/#1F2A2B` `--ink-2/#5B6B6C` | 暖黑非纯黑 |
| 免费 `--free/#2E7D5B` | 绿色，区分免费/收费 |
| 圆角 | 卡片 20rpx / 按钮 28rpx / 胶囊 999rpx |
| 字号 | 基准 32rpx；`.big` 大字模式整体放大 |

**适老化硬指标**：图标全部 Lucide 线性 SVG（零 emoji）；基准字号偏大；主操作点击区 ≥ 72rpx；聚焦/激活有可见反馈；尊重 `prefers-reduced-motion`。

## 二、架构（分层，前后端同源可移植）

```
数据服务 server.py (8789, 0.0.0.0)
   └─ /nearby?lat,lng,radius  →  pipeline-demo/oldbuddy_pipeline (DEMO_ACTIVITIES + radius_query)
       返回 { count, user, stats{1,3,5,10}, nearby[] }

┌─ 可视图原型 oldbuddy-v2/ (浏览器预览，结构 1:1 平移原生)
│   index.html
│   css/styles.css          设计系统
│   js/icons.js  store.js  api.js  ui.js  router.js  app.js   （分层：图标/状态/接口/视图/路由/编排）
│
└─ 原生小程序 miniprogram/ (微信开发者工具)
    app.js / app.json / app.wxss(脚本生成)
    services/   activity.js(数据) location.js(定位) storage.js(持久化) tts.js(语音)
    components/ activity-card/  radius-seg/   (可复用组件)
    pages/      home/ detail/ category/ me/   (四页 + 详情)
```

**定位贯穿全产品**：打开按定位拉「附近 1km（可切 1/3/5/10km，每档带活动计数）」→ 详情看单条 → 分类按 type 筛选（仍受半径约束）→ 我的收藏本地。

## 三、页面与交互

- **首页**：Hero（时段问候 + 定位条 + 半径分段 + 汇总）+ 分类九宫格 + 附近活动卡片流（按距离排序）。
- **详情**：类型/标题/距离 + 信息行（时间/地点/费用/来源）+ 一键导航(wx.openLocation) + 我要报名(**防骗确认后复制官方链接**) + 收藏。
- **分类**：类型 chips 筛选，仍锁当前半径。
- **我的**：收藏列表、大字模式、语音播报、定位、防骗须知、关于。

## 四、生产落地清单（接真·实时）

1. `services/activity.js` 的 `BASE` 改为 **HTTPS 合法域名**；开发者工具勾选「不校验合法域名」仅限开发。
2. 数据源：上海公共开放数据 app key + 高德 key（对应 PRD 假设5），替换 `pipeline-demo` 的 seed。
3. 语音播报接入微信同声传译 / 第三方 TTS 插件（当前为占位）。
4. 报名：配置业务域名后用 `web-view` 内嵌，或走官方小程序跳转。
5. 真机调试需真实 AppID（当前 `touristappid` 仅支持模拟器）。
6. tabBar 可补充 PNG 图标（微信 tabBar 图标须本地图片，当前为纯文字）。

## 五、验证记录（2026-09-03）

- v2 原型：资源全 200；/nearby 1/3/5/10km → 3/8/11/24 场；6 个 JS 语法 OK；34 个图标引用全部有定义。
- 原生：11 个 JSON + 11 个 JS 全合法；WXML 图标引用全部有定义；无缺失；已重新在开发者工具打开。
