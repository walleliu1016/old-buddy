# 老友时光 · 后端与数据设计（总览）

为「老友时光」微信小程序设计的完整后端方案。设计目标：**微信云开发承载用户态/实时/消息/支付，自有 Python 数据工厂承载爬虫+AI 汇总，两端经云数据库收敛**。

## 文件导航
| 文件 | 内容 |
|---|---|
| [DESIGN.md](./DESIGN.md) | 总体架构、双轨收敛图、数据模型（10 类实体）、微信后台存储、微信服务对接、数据工厂流程、上线清单 |
| [API.md](./API.md) | 全量接口规范（登录/附近/课程/详情/报名/收藏/我的/支付/订阅/AI汇总/采集），含请求响应示例、错误码、前端迁移映射 |
| `cloud-functions/login/` | 云函数：微信登录 → openid + token |
| `cloud-functions/activities/` | 云函数：附近(半径+多半径统计)/课程/详情 |
| `cloud-functions/booking/` | 云函数：报名(免费直建单/收费返支付)/取消/签到 |
| `cloud-functions/feedback/` | 云函数：图文反馈 + 内容安全(msgSecCheck/imgSecCheck) |
| `backend-pipeline/main.py` | 自有数据工厂(FastAPI)：多源爬虫→解析去重→地理编码→LLM适老化改写+标签→幂等 upsert 云库 |

## 关键设计决策
- **`activities` 单集合 + `kind` 字段**区分 `once`(单次活动)/`course`(长期课)，与现有前端 `by_kind()` 逻辑一致，无需改前端过滤。
- **存储边界**：云数据库=真实后台；`wx.setStorageSync`/浏览器 localStorage 仅为首屏缓存，上云后取消作为数据源。
- **数据边界**：小程序只连自有 API/云函数，第三方源(开放数据/高德/LLM)全部在自有后端，不暴露给前端。
- **适老化**：AI 环节做"大白话改写 + 标签抽取"，降低退休用户阅读门槛。

## 验证状态
- `main.py` 通过 `py_compile`；4 个云函数通过 `node --check`。
- 均为设计骨架，部署前需注入：微信 AppID、云开发 env、SH_DATA_APP_KEY、AMAP_KEY、LLM_API_KEY、商户号、订阅消息模板。
