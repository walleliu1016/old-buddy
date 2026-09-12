# 老友时光 · 部署手册（一键可落地）

> 目标：把「小程序 → 微信云开发 → 自有数据工厂」串成可上线闭环。
> 代码已全部落盘并通过语法校验（见文末「校验记录」）。

---

## ⭐ 十分钟跑通云服务（先看这节）

> 以下全部在**微信开发者工具**里点出来，不需要命令行。

1. **开通云开发**：工具打开本项目 → 顶部「云开发」按钮 → 开通（选免费基础版即可）→ 复制**环境 ID**。
2. **填配置**：`miniprogram/config.js` → `cloud.enabled: true`、`cloud.env: '你的环境ID'`。
3. **部署云函数**（共 12 个）：`cloudfunctions/` 下每个目录右键 →「上传并部署：云端安装依赖」。
   首先传 `setup`，最后传 `sync`。
4. **建集合**：运行 `setup` 云函数（右键 → 云端运行），返回 10 个集合已创建。
5. **建索引（必做）**：云开发控制台 → 数据库 → `activities` → 索引管理 →
   给 `location` 字段建 **2dsphere 地理索引**——不建的话「附近」半径查询会直接报错。
6. **灌数据**：右键运行 `sync` 云函数 → 返回 `inserted > 0`（未配 FACTORY_BASE 时自动用内置种子）。
7. **编译**：工具重新编译小程序 → 首屏「附近」已走云数据库；报名/收藏/发布全部落云。

跑不通时的排查：控制台「云函数 → 日志」看报错；`msgSecCheck` 相关需在 mp 后台开通「内容安全」接口权限。

---

## 1. 总体架构（数据流向）

```
┌──────────────┐    wx.cloud.callFunction     ┌─────────────────────────┐
│  微信小程序   │ ───────────────────────────▶ │  微信云开发 CloudBase    │
│ (退休人员端)  │                              │  ├ 云数据库 (10 集合)     │
│              │ ◀─────────────────────────── │  ├ 云函数 (12 个)        │
└──────────────┘   活动/报名/收藏/用户/反馈    │  └ 云存储 (图片/语音)     │
                                                └───────────┬─────────────┘
                                                            │ 定时/自愈调 sync
                                                            ▼
                                                ┌─────────────────────────┐
                                                │  自有数据工厂 (国内服务器) │
                                                │  FastAPI: 爬虫+AI汇总     │
                                                │  GET /api/v1/activities  │
                                                │  GET /api/v1/summary     │
                                                └─────────────────────────┘
```

**关键解耦**：数据工厂**只生产数据**，由云函数 `sync` 主动来拉再 upsert 进云库。
CloudBase 密钥不离开微信环境，少一套对外鉴权。

---

## 2. 前置条件

| 项 | 说明 |
|---|---|
| 微信小程序 AppID | 已就绪：`wx46b58d63811ff62b`（游客模式仅能模拟，真机调试需真实 AppID） |
| 云开发环境 | 微信开发者工具 → 云开发 → 开通，拿到**环境 ID** |
| 国内服务器 | 数据工厂部署处（避开放平台 WAF / 高德限流），需公网 HTTPS 可达 |
| 可选密钥 | 上海开放数据 app key、高德 key、LLM key、微信支付子商户号 |

---

## 3. 阶段一：部署数据工厂（国内服务器）

```bash
cd old-buddy-backend/backend-pipeline
pip install -r requirements.txt
# 注入环境变量后用 uvicorn 起（建议 systemd / docker 守护）
export PORT=8800
export ADMIN_KEY="你的admin密钥"
export AMAP_KEY="" LLM_API_KEY="" SH_DATA_APP_KEY=""   # 先空着也能跑（走种子+缓存兜底）
uvicorn main:app --host 0.0.0.0 --port 8800
```

验证：
```bash
curl http://localhost:8800/api/v1/health
curl "http://localhost:8800/api/v1/activities?limit=20"
```
> 拿到公网地址（如 `https://factory.example.com`）后填进云函数 `sync` 的环境变量 `FACTORY_BASE`。

---

## 4. 阶段二：微信云开发

### 4.1 建集合 + 索引（两种方式任选）

**方式 A：云函数一键建集合（推荐先跑这个）**
1. 上传 `cloudfunctions/setup` 云函数
2. 右键 →「运行」或在小程序里 `wx.cloud.callFunction({name:'setup'})`
3. 看返回 `created` 列表，确认 10 个集合都在
4. **索引仍需在控制台手动建**（见 4.2）——`setup` 只建集合

**方式 B：控制台逐个建**
云开发控制台 → 数据库 → 新建集合：`users, activities, bookings, favorites, feedbacks, messages, orgs, sync_logs, ai_summaries, categories`

### 4.2 必建索引（控制台 → 集合 → 索引管理 → 新建）

| 集合 | 索引字段 | 类型 |
|---|---|---|
| activities | `location` | **2dsphere（地理索引，半径查询必需）** |
| activities | `kind` + `status` | 普通 |
| activities | `organizer` | 普通 |
| bookings | `userId` + `activityId` | 普通 |
| bookings | `userId` + `activityId` + `status` | 复合（防重复报名） |
| favorites | `userId` + `activityId` | 普通 |
| users | `openid` | 唯一 |
| messages | `userId` + `sendAt` | 普通 |
| ai_summaries | `scope` + `scopeKey` + `period` | 普通 |

### 4.3 上传云函数（12 个）

小程序根目录 `cloudfunctions/` 下右键「上传并部署：云端安装依赖」：
`login, activities, booking, favorite, user, feedback, message, sync, pay, setup, publish`

> **publish 权限**：该函数调用了 `security.msgSecCheck`，需在 mp 后台开通「内容安全」接口权限；
> 云函数依赖 `wx-server-sdk` 自带 openapi，无需额外安装。

### 4.4 配置云函数环境变量（云开发 → 云函数 → 对应函数 → 配置 → 环境变量）

| 函数 | 变量 | 值 |
|---|---|---|
| sync | `FACTORY_SERVICE` | 数据工厂的**云托管服务名**（推荐，内网调用） |
| sync | `FACTORY_ENV` | 云托管环境 ID（一般**不用填**：同环境自动识别） |
| sync | `FACTORY_BASE` | 数据工厂公网地址（自建服务器时用，二选一） |
| sync | `ADMIN_KEY` | 与工厂 `ADMIN_KEY` 一致（仅 FACTORY_BASE 模式需要） |
| pay | `SUB_MCH_ID` | 微信支付子商户号（收费活动才需） |
| activities/booking 等 | （无需特殊变量） | — |

### 4.4.1 方案 B：数据工厂直接托管到微信云托管（推荐：免服务器 / 免域名 / 免备案）

**结论：后台服务可以完全跑在微信上，不需要域名、不需要公网 IP、不需要 ICP 备案。**

云托管（CloudBase Run）就是一个 Docker 容器托管服务，跑我们的 FastAPI 数据工厂：

1. 微信开发者工具 → 顶部「云开发」→ 开通；再进「云托管」→ 新建服务，服务名如 `oldbuddy-factory`
2. 部署方式二选一：
   - **上传代码**：把 `old-buddy-backend/backend-pipeline/` 整个目录（含已备好的 `Dockerfile`）打包上传
   - **绑定仓库**：服务设置里绑定本 GitHub 仓库，指定 `deliverables/old-buddy-backend/backend-pipeline` 为构建目录，后续 push 自动构建
3. 「服务设置 → 环境变量」注入：`SH_DATA_APP_KEY` / `AMAP_KEY` / `LLM_API_KEY`（可选，不填走种子数据）
4. 「服务设置」确认监听端口 = **80**（本服务 Dockerfile 已按 80 配置）
5. 云函数 `sync` 加环境变量：`FACTORY_SERVICE = oldbuddy-factory`
6. 完成。`sync` 通过微信**内网** `cloud.callContainer` 调用容器，请求头自动带 `X-WX-SERVICE` 指定服务名（代码已实现）

**为什么不需要域名 / IP / 备案：**
- 域名与备案是「**小程序客户端直接请求外部网址**」时才需要（要配 mp 后台的服务器域名）
- 本架构中，小程序**只调云函数**，云函数再走**内网**调云托管 —— 全程不出微信内网，天然免域名免备案
- 云托管即使有默认公网域名，也**不需要**也不能配到小程序后台；正式对外才需另绑已备案域名，我们用不到

**必须知道的云托管硬限制（会踩的坑）：**

| 限制 | 说明 | 对本项目的影响 |
|---|---|---|
| 仅 HTTP、单端口 | 不支持 TCP/UDP、不支持多监听端口 | 无影响（FastAPI 单端口 HTTP） |
| 不支持公网 IP 访问 | 只能走域名 | 无影响（我们走内网） |
| **不支持有状态服务** | 不能部署数据库 / Redis | 数据存云数据库，容器只做无状态计算 |
| **容器无持久化存储** | 重启/扩缩容会还原文件 | 不落盘文件，图片走云存储 |
| callContainer 请求 ≤ 100K | 请求体不宜含图片 | 我们是 GET 拉数据，请求极小 |
| callContainer 超时 15s | 小程序/公众号侧限制 | 云函数调用的 `sync` 若拉取慢，用定时触发器跑（无 15s 限制） |
| 缩容到 0 会冷启动 | 半小时无请求缩容，首次请求变慢 | 数据工厂每天跑一次，可接受；介意就把最小副本设为 1（持续计费） |

**替代方案 C（最省，无需容器）**：把爬虫+AI 逻辑直接写成**定时触发的云函数**（Node/JS），完全不碰容器。
代价：云函数单次执行有超时上限，LLM 逐条改写容易超时；依赖也要打进包。数据量大/要调 LLM 时，云托管更稳。
本项目保留 Python FastAPI 数据工厂 → 推荐**方案 B**。

### 4.5 配置定时触发器（每日同步）

`cloudfunctions/sync/config.json` 已内置：
```json
{ "triggers": [{ "name": "dailySync", "type": "timer", "config": "0 0 3 * * * *" }] }
```
上传 sync 函数时一并部署即可（每天凌晨 3 点拉取最新数据）。

### 4.6 首次同步

在云函数列表右键 `sync` →「运行」，或小程序里调用：
```js
wx.cloud.callFunction({ name: 'sync', data: { action: 'run', limit: 200 } })
```
返回 `source:"factory"` 或 `source:"seed"`，`inserted/updated` 计数 > 0 即成功。

---

## 5. 阶段三：小程序配置

打开 `deliverables/miniprogram/config.js`：
```js
module.exports = {
  cloud: {
    enabled: true,                              // ← 改为 true
    env: 'oldbuddy-xxxxxxxx'                    // ← 填你的云开发环境 ID
  },
  legacy: { base: 'http://192.168.31.136:8789' }, // 未开通云开发时的降级地址
  KIND_ONCE: 'once', KIND_COURSE: 'course'
};
```

> **降级模式**：`enabled:false` 时，小程序自动走 `legacy` 局域网服务（`oldbuddy-v2/server.py`），功能不受影响。可先 `false` 验证 UI，再切 `true`。

---

## 6. 环境变量速查

| 变量 | 作用域 | 必填 |
|---|---|---|
| `FACTORY_BASE` | sync 云函数 | 接 live 数据必填 |
| `ADMIN_KEY` | sync 云函数 + 工厂 | 一致即可 |
| `AMAP_KEY` | 工厂 | 坐标精确化（可空，走缓存/区级兜底） |
| `LLM_API_KEY` | 工厂 | AI 改写/汇总（可空，保留原文） |
| `SH_DATA_APP_KEY` | 工厂 | 真·开放数据（可空，走种子） |
| `SUB_MCH_ID` | pay 云函数 | 收费活动才需 |
| `LLM_BASE` / `LLM_MODEL` | 工厂 | 默认腾讯混元 |

---

## 7. 验证清单

- [ ] 工厂 `/api/v1/health` 返回 `ok:true`
- [ ] `setup` 云函数返回 10 个集合已创建
- [ ] `sync` 云函数运行后 `activities` 集合有数据
- [ ] 小程序 `config.cloud.enabled=true` 后，首屏「附近」能拉到云端活动
- [ ] 点一场活动 → 报名 → `bookings` 集合新增一条 `status:pending`
- [ ] 「我的」页能看到刚才的报名（来自云端，非本地种子）
- [ ] 反馈提交走 `msgSecCheck` 内容安全（违规被拦）
- [ ] 定时触发器在凌晨自动跑 `sync`（看 `sync_logs`）

---

## 8. 上线前必做（合规/安全）

1. **内容安全**：反馈、用户生成内容必须过 `msgSecCheck`/`imgSecCheck`（已内置 `feedback` 云函数）。
2. **位置权限**：MP 后台「开发管理 → 接口设置」声明 `getLocation` 的 `requiredPrivateInfos`。
3. **用户隐私**：头像昵称用新方案（`chooseAvatar` + 昵称 input），不强行拿 `userInfo`。
4. **业务域名**：`FACTORY_BASE` 必须备案 + HTTPS；web-view 报名页需配业务域名。
5. **支付**：正式收费前完成微信支付商户号绑定与 `pay` 回调联调。
6. **真机测试**：游客 AppID 仅模拟，需真实 AppID 才能真机调试/上传。

---

## 9. 目录与文件清单（本次交付）

```
deliverables/
├─ miniprogram/                        小程序（已接入云开发，含降级）
│  ├─ config.js                        ← 改这里启用云开发
│  ├─ app.js                          云初始化 + 静默登录 + 报名云端同步
│  └─ services/{cloud.js, activity.js} 云函数调用层 / 路由（页面零改动）
├─ cloudfunctions/                     12 个云函数（各带 package.json）
│  ├─ login activities booking favorite user feedback message
│  ├─ sync(+config.json 定时) pay setup publish
└─ old-buddy-backend/
   ├─ DESIGN.md  总体架构 + 数据模型 + 微信对接 + 上线清单
   ├─ API.md     全量接口规范（含前端迁移映射）
   ├─ DEPLOY.md  本文件
   └─ backend-pipeline/  FastAPI 数据工厂（main.py + requirements.txt）
```

---

## 10. 校验记录（交付时已过）

- `main.py`：`py_compile` 通过；无 key 走种子烟测 6 条记录全带坐标、extId 唯一、summary/health 优雅降级。
- 11 个云函数 `index.js` + `jwt.js`：`node --check` 全部通过。
- 所有 `package.json` / `sync/config.json`：JSON 合法。
- 小程序 `app.js / config.js / services/cloud.js / services/activity.js`：`node --check` 通过，字段适配与云函数返回结构对齐。
