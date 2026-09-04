# 老友时光 · API 接口规范

> 所有接口以云函数 `/api` 为统一入口（或自有网关）。除登录外均需在 Header 带 `Authorization: Bearer <token>`（token=登录下发的 openid 签名串）。
> 时间统一 ISO8601；金额单位分（内部）或展示用 `fee` 文案。坐标 `coordinates:[lng,lat]`。

---

## 通用响应
```json
{ "code": 0, "msg": "ok", "data": { } }
```
错误：`{ "code": 401, "msg": "未登录" }`

---

## 1. 登录 / 用户

### POST /auth/login
**请求**
```json
{ "code": "081abc..." }
```
小程序 `wx.login()` 拿 code。云开发环境由云函数 `getWXContext()` 直接取 openid，不走此路径；自有后端用 `code` 调 `auth.code2Session`。
**响应**
```json
{ "code":0, "data": { "openid":"oABC...", "token":"eyJ...", "isNew":true,
  "user": { "nickName":"", "avatarUrl":"", "radius":1, "settings":{"bigFont":false,"voice":false,"push":true} } } }
```

### GET /me
返回登录用户资料 + 设置 + 各状态计数。
```json
{ "code":0, "data": { "openid":"oABC...", "nickName":"王阿姨", "avatarUrl":"cloud://...",
  "phone":"138****1234", "district":"黄浦", "radius":1,
  "settings":{"bigFont":true,"voice":false,"push":true},
  "counts": { "bookings":3, "favorites":5, "pending":1 } } }
```

### PATCH /me
```json
{ "nickName":"王阿姨", "avatarUrl":"cloud://...", "radius":3,
  "settings": { "bigFont":true, "voice":true, "push":false }, "location": {"lat":31.23,"lng":121.47,"name":"人民广场"} }
```

### POST /me/phone
```json
{ "cloudID": "..." }        // 云开发：直接换明文
// 或自有后端： { "encryptedData":"...", "iv":"..." } 用 session_key 解密
```
**响应** `{ "code":0, "data": { "phone":"13800001234" } }`

---

## 2. 附近 / 课程 / 详情

### GET /activities/nearby
**Query**：`lat=31.23&lng=121.47&radius=1&category=all&keyword=&page=1&pageSize=20`

**响应**
```json
{ "code":0, "data": {
  "count": 8,
  "radius_km": 1,
  "stats": { "1":8, "3":23, "5":41, "10":70 },      // 多半径统计（吸顶筛选条用）
  "list": [
    { "_id":"33", "kind":"once", "title":"上博青铜器专题讲座", "category":"学习",
      "venue":"上海博物馆", "address":"...", "distance_km":0.4,
      "timeText":"周六 14:00", "fee":"免费", "price":0,
      "images":["cloud://..."], "district":"黄浦", "enrolledCount":0,
      "isFav":false, "isBooked":false }
  ]
} }
```
> `category` 取值：all/文艺/学习/运动/公益/市集。`stats` 由各半径 count 组成，供前端「1/3/5/10km 多少场」筛选条。

### GET /courses
**Query**：`lat=31.23&lng=121.47&category=all&keyword=&page=1&pageSize=20`（全城，不受半径限制，按距离排序）

**响应**
```json
{ "code":0, "data": { "count":12, "list": [
  { "_id":"25", "kind":"course", "title":"智能手机使用入门", "category":"学习",
    "venue":"上海市老年大学", "distance_km":1.2, "fee":"免费", "price":0,
    "weeks":"8 周", "schedule":"每周二 09:00-10:30", "startText":"9月15日开课",
    "deadline":"9月13日截止报名", "seatsText":"剩 3 个名额",
    "isFav":false, "isBooked":false }
] } }
```

### GET /activities/:id
**响应**：活动/课程全字段 + `isFav`/`isBooked`/`bookingCount` + 同主办方其他活动 `related[]`。
```json
{ "code":0, "data": {
  "_id":"25", "kind":"course", "title":"智能手机使用入门", "category":"学习",
  "description":"专为退休朋友设计的零基础课，手把手教微信、拍照、挂号……",
  "images":["cloud://..."], "price":0, "fee":"免费",
  "schedule":"每周二 09:00-10:30", "startAt":"2026-09-15T09:00:00+08:00",
  "deadlineAt":"2026-09-13T23:59:00+08:00", "seatsText":"剩 3 个名额",
  "organizer":"上海市老年大学", "contact":"021-xxxx", "district":"黄浦",
  "isFav":false, "isBooked":false, "bookingCount":9,
  "related":[ {"_id":"26","title":"国画花鸟班","fee":"¥120/学期"} ]
} }
```

---

## 3. 报名（订单）

### POST /bookings
```json
{ "activityId":"25", "kind":"course" }
```
- 免费（`price:0`）：直接建单 `status:"pending"`，返回 `{ "code":0, "data":{ "orderNo":"OB...", "status":"pending" } }`
- 收费：返回微信支付参数，前端调 `wx.requestPayment`
```json
{ "code":0, "data": { "orderNo":"OB...", "needPay":true,
  "pay": { "timeStamp":"...", "nonceStr":"...", "package":"prepay_id=...", "signType":"MD5", "paySign":"..." } } }
```
错误：`409` 重复报名（已存在非取消订单）。

### GET /bookings
**Query**：`status=pending`（pending/paid/attended/completed/cancelled/all，默认 all）`&page=1`
**响应**：订单快照列表（title/venue/timeText/fee/status/bookedAt），免费与收费合并展示，类似"我的订单"。

### PATCH /bookings/:id/cancel
```json
{ "reason":"时间冲突" }
```
`status` → `cancelled`（付费单进入 `refunding` 并触发退款）。

### POST /bookings/:id/checkin
活动当天扫码/点击签到，`checkinAt` 写入，`status`→`attended`。

---

## 4. 收藏

### POST /favorites/toggle
```json
{ "activityId":"33" }
```
**响应** `{ "code":0, "data": { "isFav":true } }`（幂等切换）

### GET /favorites
返回收藏列表（同 `/activities/nearby` 的 item 结构，含 distance）。

---

## 5. 反馈 / 上传 / 订阅

### POST /upload
`multipart/form-data`，file 字段。**响应** `{ "code":0, "data": { "fileID":"cloud://..." } }`（云存储）

### POST /feedback
先走内容安全（`msgSecCheck`/`imgSecCheck`），通过才落库。
```json
{ "activityId":"25", "rating":5, "comment":"老师讲得清楚，下次还来", "images":["cloud://..."] }
```
**响应** `{ "code":0, "data": { "id":"...", "secCheckStatus":"pass" } }`
若命中：`{ "code":422, "msg":"含敏感内容，未提交" }`

### POST /messages/subscribe
```json
{ "templateId":"xxxxx", "type":"booking_reminder" }
```
存用户订阅授权，供 `booking` 创建/活动变更时发订阅消息。

---

## 6. 支付（收费活动/课程）

### POST /pay/unifiedorder
由 `POST /bookings`（收费）内部调用，向后端/云支付下单，返回 `pay` 参数给前端。

### POST /pay/notify
微信支付异步回调（自有商户号需配回调域名；云支付由云函数事件接收）。校验签名后：
`booking.status` → `paid`，写 `payment.{transactionId,paidAt,amount}`，并触发报名成功订阅消息。

---

## 7. AI 汇总 / 采集（数据工厂侧）

### GET /ai/summary
**Query**：`scope=city|district|category&scopeKey=黄浦|文艺&period=week`
**响应**
```json
{ "code":0, "data": {
  "scope":"district", "scopeKey":"黄浦", "period":"week",
  "content":"本周黄浦免费文艺活动扎堆，推荐 3 场：上博青铜器讲座（周六）、人民公园戏曲票友会（周日）、南京路老照片展（全天）。适合喜欢逛展馆的朋友。",
  "topActivityIds":["33","34","35"]
} }
```
> 前端可在「附近」页顶部或「我的」页放一个"本周推荐"卡片消费此接口。

### POST /admin/sync
**内部接口，需 `X-Admin-Key` 或云函数定时触发器调用。**
```json
{ "sources":["sh_opendata","amap"], "force":false }
```
**响应**
```json
{ "code":0, "data": {
  "provenance": { "activities_source":"live_opendata", "geo_source":"amap" },
  "fetched":120, "inserted":15, "updated":40, "durationMs":8200,
  "aiSummary": { "generated": true, "model":"hunyuan-standard" }
} }
```

---

## 8. 主办方
### GET /orgs/:id
**响应** `{ "code":0, "data": { "name":"上海市老年大学", "type":"老年大学", "district":"黄浦", "contact":"021-xxxx", "verified":true, "activityCount":32 } }`

---

## 9. 用户发布兴趣活动（云函数 `publish`）

> 用户自助发布单次兴趣活动，写回 `activities` 集合（`source:"user"`、`kind:"once"`、`auditStatus:"pass"`），
> 「附近」查询**零改动**即可混入按距离排序。发布前自动过 `msgSecCheck` 内容安全。

### create —— 发布
```json
{ "action":"create", "title":"周日晨练太极小组", "category":"运动",
  "timeText":"9月20日 14:00", "venue":"社区活动室", "address":"XX路XX号",
  "lat":31.23, "lng":121.47, "price":0, "capacity":0,
  "description":"自带水杯", "contact":"138****" }
```
- 必填：`title`(≥2字) / `timeText` / `venue` / `address`
- `price` 分为单位（前端元×100）；0 = 免费
- 返回 `{ "code":0, "data":{ "_id":"..." } }`
- 错误：`403` 内容安全拦截；`422` 必填缺失

### mine —— 我发布的
**响应**：`{ "code":0, "data":{ "list":[...活动文档...] } }`，按 `createdAt` 倒序，上限 50。

### offline —— 下架
`{ "action":"offline", "id":"..." }` → `status:"offline"`（仅发布者本人可操作，否则 `404`）。

**前端**：入口 = 附近页右下「＋ 发布」FAB + 我的页「我发布的」行；页面 `pages/publish/publish`
（顶部双 tab：发布 / 我发布的）。未开通云开发时降级为本机暂存（`local_posts`）。

---

## 10. 错误码
| code | 含义 |
|---|---|
| 0 | 成功 |
| 401 | 未登录 / token 失效 |
| 403 | 无权限（如非 admin 调 sync）|
| 404 | 资源不存在 |
| 409 | 冲突（重复报名）|
| 422 | 参数错误 / 内容安全命中 |
| 429 | 频率限制 |
| 500 | 服务端错误 |

---

## 10. 与现有代码的映射（迁移指引）
- 前端 `activity.js` 的 `nearby(lat,lng,radius,name)` → 改为 `GET /activities/nearby`（同参）。
- `courses(lat,lng,name)` → `GET /courses`。
- `storage.js` 的 `getBookings/saveBookings` / `favorites` → 全部改为云数据库，本地仅留首屏缓存。
- `oldbuddy_pipeline.py` 的 `run_pipeline` → 迁为数据工厂 `main.py` 的 `sync()`，新增 AI 改写与云库 upsert。
- 现有 `kind:"once"/"course"` 字段**保持不变**，前端 `by_kind()` 逻辑无需改。
