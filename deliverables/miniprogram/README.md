# 老友时光 · 微信小程序（原生工程）

面向 50–60 岁城市退休族（帮子女带孙子、白天有空闲）的社区活动发现小程序。AI 自动聚合上海全市社区/文化/老年教育活动，用户打开即按手机定位看到「附近 1km（可切 1/3/5/10km）本周有什么活动」。

本目录是**微信原生小程序工程**，可直接在微信开发者工具导入、预览、发布——不是网页套壳。

## 工程结构
```
miniprogram/
├── app.js / app.json / app.wxss      # 全局状态 + 设计令牌（CSS 变量）+ 图标类 + 共享样式
├── config.js                          # 云开发环境 / 本地数据服务地址，一处配置全端生效
├── project.config.json / sitemap.json
├── services/
│   ├── activity.js / cloud.js   # 活动数据访问层（云开发优先，未开通自动降级本地服务）
│   └── location.js / storage.js / tts.js  # 定位 / 本地持久化 / 语音播报
├── utils/
│   ├── api.js     # 封装 /nearby、/refresh（BASE 可改）
│   ├── store.js   # 本地收藏 + 设置持久化
├── components/
│   └── activity-card/  # 活动卡片组件（各活动列表复用）
├── assets/
│   ├── icons/   # 本地 PNG 图标
│   └── tabbar/  # tabBar 本地 PNG 图标
└── pages/
    ├── home/      # 「附近」tab：Hero 发现面板 + 分类九宫格 + 附近活动流
    ├── courses/   # 「课程」tab：长期课列表
    ├── me/        # 「我的」tab：收藏列表、大字模式、语音播报、定位、防骗须知
    ├── detail/    # 活动详情：时间地点/一键导航/我要报名(防骗)/收藏/分享
    ├── bookings/  # 我的报名
    └── publish/   # 发布活动
```

## 本地运行（演示）
1. 微信开发者工具 → 导入项目 → 选择本目录 `deliverables/miniprogram`。
2. AppID 选「测试号」或你自己的小程序 AppID。
3. 详情 → 本地设置 → 勾选 **「不校验合法域名、web-view、TLS 以及 HTTPS 证书」**。
4. 确保本地后端在运行（已在 8788 端口）：
   ```
   cd deliverables/pipeline-demo && python3 server.py
   ```
   `utils/api.js` 的 `BASE` 默认指向 `http://127.0.0.1:8788`。
5. 编译预览。首页会自动按默认定位拉取「附近 1/3/5/10km」活动。

## 生产部署
- 把 `utils/api.js` 的 `BASE` 改为你的 **HTTPS 域名**，并在微信公众平台
  「开发 → 开发设置 → 服务器域名」配置 request 合法域名。
- 后端 `server.py` 可替换为云函数 / 容器部署，并接入真实数据源
  （上海公共开放数据 app key + 高德地理编码 key，详见 PRD「假设5」）。

## 设计要点
- 配色：砖红主色 `#C8472E` + 暖橙 `#E8743B`，米色底 `#F4EFE4`（适老高对比、暖色可信赖）；
  设计令牌集中在 `app.wxss` 顶部的 CSS 变量（`--primary` / `--accent` / `--bg` 等）。
- 图标：本地 PNG 图标（`assets/icons/`，tabBar 用 `assets/tabbar/`），**零 emoji、零外部依赖**。
- 适老化：基础字号 30rpx（可在「我的」放大至 34rpx）、大点击区、
  焦点可达、`prefers-reduced-motion` 风格；报名带**防诈骗确认闭环**。

## 已知限制（演示态）
- 语音播报为设置开关；真实朗读需接入微信同声传译/语音合成插件，本演示未接。
- 报名为「复制官方链接」而非内嵌 web-view（需配置业务域名后方可内嵌）。
