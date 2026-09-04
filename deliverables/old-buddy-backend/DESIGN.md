# 老友时光 · 后端与数据架构设计

> 面向 50–60 岁退休族的微信小程序。本文件定义**数据模型、微信后台存储、微信服务对接、自有爬虫+AI 数据工厂、全量 API**。
> 设计原则：**微信云开发做用户态与实时/消息/支付，自有 Python 数据工厂做重采集与 AI 汇总，两端通过云数据库收敛。**

---

## 1. 总体架构（双轨收敛）

```
┌─────────────────────────────────────────────────────────────┐
│                     微信小程序（前端）                         │
│  附近(home) · 课程(courses) · 详情(detail) · 报名(bookings) · 我的(me) │
└───────────────┬───────────────────────────┬─────────────────┘
                │ wx.login / request / cloud.callFunction
                ▼                           ▼
   ┌──────────────────────────┐   ┌──────────────────────────────┐
   │   微信云开发 CloudBase     │   │   自有数据工厂 (Python/FastAPI) │
   │  · 云数据库(活动/用户/订单)│   │  · 多源爬虫适配器              │
   │  · 云存储(图片/fileID)    │   │  · 解析/去重/地理编码          │
   │  · 云函数(登录/查询/支付) │   │  · LLM 适老化汇总+标签抽取     │
   │  · 内容安全/订阅消息/云支付│   │  · 定时调度(每日/每6h)         │
   └────────────┬─────────────┘   └───────────────┬──────────────┘
                │                                  │
                │          upsert 聚合结果          │
                └──────────────┬───────────────────┘
                               ▼
                  云数据库 activities / courses / ai_summaries
                  （小程序只读这层，写由数据工厂+云函数负责）
```

**职责边界（关键）**
- 小程序**只与自有 API/云函数通信**，绝不直接连第三方源（与有色金属看板的数据边界一致）。
- 云开发承载：用户身份、实时查询、收藏/报名、图片存储、内容安全、订阅消息、微信支付。
- 自有数据工厂承载：公共开放数据爬取、地理编码、AI 汇总改写、对活动数据做 upsert。
- 触发方式：云函数定时触发器 → 调数据工厂 `/api/v1/sync`；或数据工厂自行 cron 后直接写云数据库（用 CloudBase Admin SDK / HTTP API）。

---

## 2. 数据模型（实体 + 字段）

> 约定：云数据库为文档型（类 MongoDB）。`activities` 集合用 `kind` 字段区分 `once`(单次活动) 与 `course`(长期课)，与现有前端 `by_kind()` 逻辑一致。金额统一存 `price:number`（0=免费），展示文案 `fee` 由后端生成。

### 2.1 users（用户）
| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 系统生成 |
| `openid` | string | 微信唯一标识，**唯一索引** |
| `unionid` | string | 跨公众号/App，可选 |
| `nickName` | string | 头像昵称新方案：`button open-type="chooseAvatar"` + `input type="nickname"` |
| `avatarUrl` | string | 云存储 fileID 或 https |
| `phone` | string | `getPhoneNumber` 解密，**加密存储** |
| `city`/`district` | string | 定位所在区，用于就近推荐（如"黄浦"）|
| `location` | {lat,lng,name,updatedAt} | 当前定位 |
| `radius` | number | 默认发现半径 1/3/5/10，默认 1 |
| `interests` | string[] | 兴趣标签（浏览/收藏推断）|
| `settings` | {bigFont,voice,push} | 适老化开关 |
| `createdAt`/`lastActiveAt` | date | |
| `status` | string | normal/blocked |

### 2.2 activities（活动 + 课程，按 kind 区分）
公共字段：
| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | |
| `kind` | "once"\|"course" | **索引**，区分单次活动/长期课 |
| `title` | string | **索引**（模糊搜索）|
| `category` | string | 文艺/学习/运动/公益/市集，**索引** |
| `venue` | string | 场馆名 |
| `address` | string | 详细地址 |
| `location` | {type:"Point",coordinates:[lng,lat]} | **2dsphere 地理索引** |
| `timeText` | string | 展示"周三 14:00" |
| `startAt`/`endAt` | date | 用于排序/过期（once）|
| `fee` | string | 展示"免费"/"¥80" |
| `price` | number | 0=免费，用于支付 |
| `signupType` | string | onsite/wechat/mini/link |
| `signupUrl` | string | 外部报名链接 |
| `description` | string | 长文（AI 适老化改写后）|
| `images` | string[] | 云存储 fileID |
| `organizer`/`organizerId` | string | 主办方（→ orgs._id）|
| `contact` | string | 联系人/电话 |
| `district` | string | 区，**索引** |
| `capacity`/`enrolledCount` | number | 名额/已报名 |
| `status` | string | active/ended/cancelled |
| `source` | string | live_opendata/seed/partner/manual |
| `geoSource` | string | amap/cache/seed |
| `aiTags` | string[] | AI 抽取标签 |
| `viewCount`/`favCount`/`bookingCount` | number | 计数 |
| `createdAt`/`updatedAt`/`syncAt` | date | syncAt=采集时间 |

课程专属（`kind:"course"` 时存在）：
| 字段 | 类型 | 说明 |
|---|---|---|
| `weeks` | string | "16 周" |
| `schedule` | string | "每周三 14:00-15:30" |
| `startText` | string | "9月16日开课" |
| `startAt` | date | 开课日 |
| `deadline` | string | "9月14日截止报名" |
| `deadlineAt` | date | 报名截止 |
| `seatsText` | string | "剩 12 个名额" |
| `semesterFee` | string | "¥120/学期" |
| `level` | string | 初级/中级 |
| `prerequisites` | string |  prerequisites |

### 2.3 bookings（报名/订单）
| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | |
| `orderNo` | string | 订单号，**唯一** |
| `userId` | string | → users.openid |
| `activityId` | string | → activities._id |
| `kind`/`title`/`venue`/`timeText`/`fee` | 快照 | 防止活动改了历史订单错位 |
| `price` | number | |
| `status` | string | pending/paid/attended/completed/cancelled/refunding |
| `isPaid` | bool | |
| `payment` | {method,transactionId,paidAt,amount} | 微信支付结果 |
| `bookedAt`/`cancelledAt`/`checkinAt` | date | |
| `reminderSent` | bool | 订阅消息是否已发 |

### 2.4 favorites（收藏）
| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | |
| `userId`/`activityId` | string | **联合唯一索引** |
| `createdAt` | date | |

### 2.5 feedbacks（反馈/评价）
| 字段 | 类型 | 说明 |
|---|---|---|
| `_id`/`userId`/`activityId` | | |
| `rating` | number | 1–5 |
| `comment`/`images` | | 图片为 fileID |
| `secCheckStatus` | string | pass/risky/review（接内容安全）|
| `reply`/`status` | | pending/resolved |

### 2.6 messages（订阅消息/系统通知）
| 字段 | 类型 | 说明 |
|---|---|---|
| `_id`/`userId` | | |
| `type` | string | booking_reminder/activity_update/system |
| `templateId` | string | 微信订阅消息模板 |
| `title`/`body`/`payload` | | payload=跳转参数 |
| `sendStatus` | string | unsent/sent/failed |
| `sendAt`/`readAt` | date | |

### 2.7 orgs（主办方）
| 字段 | 类型 | 说明 |
|---|---|---|
| `_id`/`name`/`type` | | 街道/文化馆/老年大学/第三方 |
| `district`/`contact`/`verified`/`logo` | | |

### 2.8 sync_logs（采集同步日志，数据工厂侧）
| 字段 | 类型 | 说明 |
|---|---|---|
| `_id`/`source`/`datasetId` | | |
| `lastSyncAt`/`status` | | success/failed/partial |
| `fetchedCount`/`insertedCount`/`updatedCount`/`error`/`durationMs` | | |

### 2.9 ai_summaries（AI 汇总）
| 字段 | 类型 | 说明 |
|---|---|---|
| `_id`/`scope` | string | city/district/category |
| `scopeKey` | string | 如"黄浦"/"文艺" |
| `period` | string | day/week |
| `content` | string | AI 导语/推荐（适老化大白话）|
| `topActivityIds` | string[] | |
| `model`/`generatedAt` | | |

### 2.10 categories（分类字典，亦可前端常量）
`{key,label,icon,sort,active}`，与现有 `OB.CATEGORIES` 对齐（全部/文艺/学习/运动/公益/市集）。

---

## 3. 如何把数据保存到微信后台

**"微信后台"= 微信云开发 CloudBase**（云数据库 + 云存储 + 云函数），不是 `wx.setStorageSync`（那只是手机本地缓存，换设备即丢，且上限 10MB）。

| 存什么 | 存哪里 | 方式 |
|---|---|---|
| 活动/课程/主办方 | 云数据库 `activities`/`orgs` | 数据工厂 upsert |
| 用户/收藏/报名/反馈/消息 | 云数据库 `users`/`favorites`/`bookings`/`feedbacks`/`messages` | 云函数写 |
| 头像/活动图/反馈图 | 云存储（fileID）| `wx.cloud.uploadFile` / 后端 `uploadFile` |
| 用户身份(openid) | 云函数 `getWXContext()` | 免密自动拿到 |

**最小落地示例（云函数写报名）：**
```js
const cloud = require('wx-server-sdk'); cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
exports.main = async (e) => {
  const { OPENID } = cloud.getWXContext();
  return db.collection('bookings').add({ data: { userId: OPENID, activityId: e.activityId, status: 'pending', bookedAt: new Date() } });
};
```

**降级说明**：Web 原型(v2) 当前把收藏/报名放浏览器 `localStorage`，小程序放 `wx.setStorageSync`——这都只是**客户端缓存**。上云后统一改为云数据库，本地仅留轻量缓存加速首屏。

---

## 4. 对接微信的服务

| 服务 | 小程序端 | 后端/云函数实现 | 备注 |
|---|---|---|---|
| **登录** | `wx.login()` 取 code | 云函数 `getWXContext()` 直拿 openid（无需自己 code2Session）；自有后端用 `auth.code2Session` | 云开发最省事 |
| **头像昵称** | `button open-type="chooseAvatar"` + `input type="nickname"` | 直接存 | 2022 后 `getUserProfile` 不再返真实信息 |
| **手机号** | `wx.getPhoneNumber` 返 code/cloudID | 云函数用 cloudID 直拿明文；自有后端用 session_key 解密 | 需企业主体 |
| **微信支付** | `wx.requestPayment` | 云开发 `cloud.cloudPay` 统一下单 + 支付结果回调 `pay/notify` | 课程/收费活动 |
| **订阅消息** | `wx.requestSubscribeMessage` 授权 | 云函数 `subscribeMessage.send` | 报名提醒/活动变更，模板需 MP 后台申请 |
| **内容安全** | 用户发图/文时 | `security.msgSecCheck` / `imgSecCheck` | 反馈、UGC 必接，否则审核不合规 |
| **位置** | `wx.getLocation`/`chooseLocation` | 后端做半径查询 | MP 后台需声明 `requiredPrivateInfos` + `scope.userLocation` |
| **分享** | `onShareAppMessage`/`onShareTimeline` | — | 裂变获客 |
| **客服消息** | 客服会话 | 公众号/小程序客服 | 可选 |

---

## 5. 自有后台：爬虫 + AI 汇总数据工厂

详见 `backend-pipeline/main.py`（FastAPI 骨架，沿用现有 `oldbuddy_pipeline.py` 的 crawl→parse→geocode→analyze 闭环，并加上 AI 改写与云数据库写入）。

流程：
1. **爬取**：上海公共数据开放平台（已核实数据集 id，需实名 app key）+ 各区文旅局 + 老年大学官网 + 合规第三方。统一 `fetch_*` 适配器，失败回退种子。
2. **解析/去重**：`normalize` 到统一 schema；按「日期是否区间/是否含课时」判定 `kind`；按 (title+venue+startAt) 去重。
3. **地理编码**：高德/腾讯 geo API → `location`；失败回退坐标缓存。
4. **AI 汇总（核心增量）**：用 LLM（混元/通义/DeepSeek）做三件事——
   - **适老化改写**：把"9月16日开课/TC 0/0"等转成大白话；
   - **标签抽取**：`aiTags`（如"适合初学者""免费用餐"）；
   - **城市/区/分类导语**：生成 `ai_summaries.content`（如"本周黄浦文艺活动扎堆，推荐 3 场免费"）。
5. **写入**：聚合结果 upsert 进云数据库 `activities`（按 `_id`/外部 id 幂等）；AI 摘要写 `ai_summaries`；写 `sync_logs`。
6. **调度**：云函数定时触发器（每日 06:00 / 每 6h）调 `/api/v1/sync`；或数据工厂 cron 直写。

> ⚠ 真实门槛（已在 pipeline 注明）：开放平台需实名 app key + 国内服务器规避 WAF/限流；高德 key 同理。数据工厂**必须部署在国内节点**。

---

## 6. API 总览（全量，详见 `API.md`）

| 场景 | 方法+路径 | 说明 |
|---|---|---|
| 登录 | `POST /auth/login` | code→openid+token |
| 附近活动 | `GET /activities/nearby` | 半径+分类+关键词+分页，返 once 与 stats |
| 课程 | `GET /courses` | 全城 course，按距离排序 |
| 详情 | `GET /activities/:id` | 含 isFav/isBooked（带 userId）|
| 报名 | `POST /bookings` | 免费→pending；付费→返支付参数 |
| 我的报名 | `GET /bookings` | 按 status 过滤 |
| 取消报名 | `PATCH /bookings/:id/cancel` | |
| 签到 | `POST /bookings/:id/checkin` | 可选 |
| 收藏切换 | `POST /favorites/toggle` | |
| 我的收藏 | `GET /favorites` | |
| 个人资料 | `GET /me` · `PATCH /me` | 含 settings |
| 手机号 | `POST /me/phone` | 解密 |
| 反馈 | `POST /feedback` | 图文+内容安全 |
| 图片上传 | `POST /upload` | →云存储 fileID |
| 订阅授权 | `POST /messages/subscribe` | 存 templateId |
| 支付下单 | `POST /pay/unifiedorder` | |
| 支付回调 | `POST /pay/notify` | 微信异步通知 |
| AI 汇总 | `GET /ai/summary` | 城市/区/分类 |
| 触发采集 | `POST /admin/sync` | 内部，需鉴权 |
| 主办方 | `GET /orgs/:id` | |

错误码：`0` 成功 / `401` 未登录 / `403` 无权限 / `404` 不存在 / `409` 重复报名 / `422` 参数错误 / `429` 频率限制 / `500` 服务端。

---

## 7. 上线前置清单（给你后续一把梭）

- [ ] 微信公众平台：注册**企业/组织类**小程序（个人号无支付、无手机号、无内容安全接口）
- [ ] 开通**微信云开发**，建上述集合 + 地理索引
- [ ] 云函数部署：`login` `activities` `booking` `feedback` `pay` `message` + 定时触发器
- [ ] 申请订阅消息模板（报名提醒/活动变更）
- [ ] 接入微信支付（商户号 + 云支付配置）
- [ ] 数据工厂：国内服务器部署 FastAPI，注入 `SH_DATA_APP_KEY` / `AMAP_KEY`，CloudBase Admin 密钥
- [ ] MP 后台配置 `request` 合法域名、`requiredPrivateInfos: ["getLocation"]`、类目（生活服务/教育）
- [ ] 内容安全：所有 UGC 走 `msgSecCheck`/`imgSecCheck`

> 下一步建议：先上「云开发 + 种子数据 + 本地缓存」跑通端到端，再把数据工厂接上做 live 采集与 AI 汇总。需要我直接把云函数/数据工厂写成可部署代码就告诉我。
