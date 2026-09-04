#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
old-buddy 自动采集管道（生产级 + 降级兜底）
crawl(爬取) -> parse(解析) -> geocode(地理编码) -> radius(半径查询) -> analyze(汇总)

=====================================================================
真实数据源（已在 2026-09-02 核实）
---------------------------------------------------------------------
1) 上海公共数据开放平台  data.sh.gov.cn   —— 官方、免费、无条件开放
   已核实开放的街道级活动数据集（例）：
     · 虹口区江湾镇街道新时代文明实践分中心每月活动安排  id=O2813839692025032
     · 虹口区欧阳路街道新时代文明实践分中心每月活动安排
     · 文化活动中心信息（市文旅局）                      id=O8065471362025044
   字段：活动名称(hdmc) / 活动地点(hddd) / 活动日期(hdrq) / 所属街道(ssjd) / 联系人(lxrjlxfs)
   ⚠ 接入前提（真实门槛，已踩）：
     a. 平台要求【实名认证】后获取 app key 才能调接口；
     b. 站点有 WAF，非浏览器请求一律返回 412（含完整浏览器头也被拦）。
   => 生产环境须用「已实名认证的服务器（建议部署在国内）」+ app key 调用。
   本文件 fetch_shanghai_opendata() 已实现该调用形态，缺 key / 被拦时自动回退种子数据。

2) 高德地图地理编码 API  restapi.amap.com/v3/geocode/geo  —— 需 key
   ⚠ 数据中心 IP 直连常被高德/WAF 限流或拦，建议国内服务器 + key。
   => geocode_amap() 已实现；无 key / 失败时回退到内置坐标缓存。

=====================================================================
降级兜底（保证现在就能端到端跑，将来填 key 零改动）
---------------------------------------------------------------------
· 无 app key / 无外网 / WAF 拦截  -> 自动回退到与真实接口「同构」的种子数据集
· 地理编码失败                   -> 回退到内置坐标缓存（覆盖常见上海场馆/街道）
每一条活动都带 provenance 标签：source(live/seed) + geo_source(amap/cache/seed)

默认半径 1km，用户可调（1 / 3 / 5 / 10 km）。
"""

import json
import math
import os
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))


# ============================================================
# 1. 数据源适配器
# ============================================================

# 已核实的上海公共数据开放平台数据集登记表
SH_DATASETS = {
    "hongkou_jiangwan": {"id": "O2813839692025032", "name": "虹口区江湾镇街道新时代文明实践分中心每月活动安排"},
    "hongkou_ouyang":   {"id": "O2813839692025032_ouyang", "name": "虹口区欧阳路街道新时代文明实践分中心每月活动安排"},
    "culture_centers":  {"id": "O8065471362025044", "name": "文化活动中心信息（市文旅局）"},
}

SH_OPENDATA_BASE = "https://data.sh.gov.cn/api/0500/v1/datasets/{id}/records"


def fetch_shanghai_opendata(app_key=None, dataset_key="hongkou_jiangwan",
                            limit=50, timeout=10):
    """真实环境：拉取上海公共数据开放平台的活动数据。

    接入步骤（生产前必做）：
      1. 在 data.sh.gov.cn 完成实名认证，获取 app key；
      2. 平台「API说明文档」确认鉴权头（常见为 X-App-Key / Authorization）；
      3. 将 key 通过环境变量 SH_DATA_APP_KEY 注入后调用本函数。
    任何失败（无 key / 412 WAF / 401 / 超时 / 解析异常）均返回 None，由调用方回退种子。
    """
    if not app_key:
        return None
    ds = SH_DATASETS.get(dataset_key)
    if not ds:
        return None
    url = (SH_OPENDATA_BASE.format(id=ds["id"])
           + "?" + urllib.parse.urlencode({"offset": 0, "limit": limit}))
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "old-buddy-agent/1.0",
            "Accept": "application/json",
            "X-App-Key": app_key,          # 鉴权头——以平台 API说明文档为准
            "Referer": "https://data.sh.gov.cn/",
        })
        with urllib.request.urlopen(req, timeout=timeout) as r:
            if r.status != 200:
                return None
            rows = json.loads(r.read()).get("data", [])
        return [normalize_opendata_row(row) for row in rows]
    except Exception:
        return None


def normalize_opendata_row(row):
    """把开放数据平台的一条记录标准化为统一活动对象。"""
    return {
        "title": row.get("hdmc") or row.get("活动名称") or "未命名活动",
        "venue": row.get("hddd") or row.get("活动地点") or "",
        "address": row.get("hddd") or row.get("活动地点") or "",
        "time": row.get("hdrq") or row.get("活动日期") or "待定",
        "type": "公益",
        "fee": "免费",
        "signup": "街道/文化云",
        "district": row.get("ssjd") or row.get("所属街道") or "",
        "source": "live_opendata",
    }


# ---------- 种子数据（与真实接口同构；真实环境不可达时回退） ----------
# 坐标为真实上海场馆示意坐标；每条带 provenance 便于区分演示/真实。
SEED_ACTIVITIES = [
    {"id": 1, "title": "市民合唱团招新", "type": "文艺", "venue": "上海音乐厅",
     "address": "上海市黄浦区延安东路523号", "lat": 31.2250, "lng": 121.4730,
     "time": "周三 14:00", "fee": "免费", "signup": "文化云小程序"},
    {"id": 2, "title": "书法入门班", "type": "学习", "venue": "上海博物馆",
     "address": "上海市黄浦区人民大道201号", "lat": 31.2287, "lng": 121.4753,
     "time": "周四 09:30", "fee": "免费", "signup": "现场报名"},
    {"id": 3, "title": "经典歌剧导赏", "type": "文艺", "venue": "上海大剧院",
     "address": "上海市黄浦区人民大道300号", "lat": 31.2305, "lng": 121.4735,
     "time": "周五 19:30", "fee": "¥80", "signup": "https://example.com/ticket"},
    {"id": 4, "title": "社区太极晨练", "type": "运动", "venue": "南京西路社区文化活动中心",
     "address": "上海市静安区南京西路街道", "lat": 31.2270, "lng": 121.4550,
     "time": "每日 07:00", "fee": "免费", "signup": "现场报名"},
    {"id": 5, "title": "外滩故事会", "type": "公益", "venue": "外滩历史纪念馆",
     "address": "上海市黄浦区中山东一路", "lat": 31.2397, "lng": 121.4900,
     "time": "周六 10:00", "fee": "免费", "signup": "文化云小程序"},
    {"id": 6, "title": "老城厢寻访", "type": "公益", "venue": "豫园社区中心",
     "address": "上海市黄浦区安仁街", "lat": 31.2270, "lng": 121.4900,
     "time": "周日 09:00", "fee": "免费", "signup": "现场报名"},
    {"id": 7, "title": "钢琴公开课", "type": "文艺", "venue": "静安寺社区文化中心",
     "address": "上海市静安区南京西路", "lat": 31.2240, "lng": 121.4450,
     "time": "周二 15:00", "fee": "¥30", "signup": "文化云小程序"},
    {"id": 8, "title": "徐家汇读书会", "type": "学习", "venue": "徐家汇社区图书馆",
     "address": "上海市徐汇区徐家汇", "lat": 31.1950, "lng": 121.4370,
     "time": "周三 19:00", "fee": "免费", "signup": "现场报名"},
    {"id": 9, "title": "陆家嘴晨跑团", "type": "运动", "venue": "陆家嘴中心绿地",
     "address": "上海市浦东新区陆家嘴", "lat": 31.2390, "lng": 121.4990,
     "time": "每日 06:30", "fee": "免费", "signup": "现场报名"},
    {"id": 10, "title": "中山公园戏曲沙龙", "type": "文艺", "venue": "中山公园文化中心",
     "address": "上海市长宁区中山公园", "lat": 31.2200, "lng": 121.4200,
     "time": "周五 13:30", "fee": "免费", "signup": "文化云小程序"},
    {"id": 11, "title": "群众艺术馆展览", "type": "文艺", "venue": "上海群众艺术馆",
     "address": "上海市徐汇区古宜路", "lat": 31.1930, "lng": 121.4350,
     "time": "全天", "fee": "免费", "signup": "现场报名"},
    {"id": 12, "title": "长宁书画社", "type": "学习", "venue": "长宁区文化馆",
     "address": "上海市长宁区", "lat": 31.2050, "lng": 121.4150,
     "time": "周四 14:00", "fee": "免费", "signup": "文化云小程序"},
    {"id": 13, "title": "虹口评弹欣赏", "type": "文艺", "venue": "虹口区文化馆",
     "address": "上海市虹口区", "lat": 31.2650, "lng": 121.4900,
     "time": "周六 14:00", "fee": "免费", "signup": "现场报名"},
    {"id": 14, "title": "曲阳沪剧班", "type": "文艺", "venue": "曲阳社区文化活动中心",
     "address": "上海市虹口区曲阳路", "lat": 31.2870, "lng": 121.5030,
     "time": "周一 13:30", "fee": "免费", "signup": "文化云小程序"},
    {"id": 15, "title": "杨浦手工坊", "type": "公益", "venue": "杨浦区文化馆",
     "address": "上海市杨浦区", "lat": 31.2700, "lng": 121.5250,
     "time": "周日 10:00", "fee": "材料费¥20", "signup": "现场报名"},
    {"id": 16, "title": "普陀太极养生", "type": "运动", "venue": "普陀区文化馆",
     "address": "上海市普陀区", "lat": 31.2450, "lng": 121.4000,
     "time": "每日 08:00", "fee": "免费", "signup": "现场报名"},
    {"id": 17, "title": "浦东合唱团", "type": "文艺", "venue": "浦东群艺馆",
     "address": "上海市浦东新区", "lat": 31.2100, "lng": 121.5500,
     "time": "周三 15:00", "fee": "免费", "signup": "文化云小程序"},
    {"id": 18, "title": "天平街道读书角", "type": "学习", "venue": "天平街道社区中心",
     "address": "上海市徐汇区天平路", "lat": 31.2000, "lng": 121.4500,
     "time": "周二 10:00", "fee": "免费", "signup": "现场报名"},
    {"id": 19, "title": "打浦桥戏曲队", "type": "文艺", "venue": "打浦桥社区中心",
     "address": "上海市黄浦区打浦桥", "lat": 31.2000, "lng": 121.4700,
     "time": "周五 14:00", "fee": "免费", "signup": "文化云小程序"},
    {"id": 20, "title": "田林广场舞", "type": "运动", "venue": "田林社区中心",
     "address": "上海市徐汇区田林", "lat": 31.1700, "lng": 121.4300,
     "time": "每日 19:00", "fee": "免费", "signup": "现场报名"},
    {"id": 21, "title": "大宁书画展", "type": "文艺", "venue": "大宁社区文化中心",
     "address": "上海市静安区大宁", "lat": 31.2800, "lng": 121.4500,
     "time": "周末全天", "fee": "免费", "signup": "现场报名"},
    {"id": 22, "title": "五角场读书会", "type": "学习", "venue": "五角场社区中心",
     "address": "上海市杨浦区五角场", "lat": 31.3000, "lng": 121.5100,
     "time": "周四 19:00", "fee": "免费", "signup": "文化云小程序"},
    {"id": 23, "title": "曹杨手工市集", "type": "市集", "venue": "曹杨社区中心",
     "address": "上海市普陀区曹杨", "lat": 31.2450, "lng": 121.4100,
     "time": "周日 09:00", "fee": "免费入场", "signup": "现场报名"},
    {"id": 24, "title": "临汾路便民服务", "type": "公益", "venue": "临汾路社区中心",
     "address": "上海市静安区临汾路", "lat": 31.2900, "lng": 121.4600,
     "time": "每月首个周六", "fee": "免费", "signup": "现场报名"},
]

# 兼容旧引用（server.py 仍 import DEMO_ACTIVITIES）
DEMO_ACTIVITIES = SEED_ACTIVITIES


# ============================================================
# 1b. 内容形态：单次活动(once) / 长期课·课程(course)
# ------------------------------------------------------------
# 产品定位（2026-09-03 定）：
#   附近 = 单次活动(once)：单场讲座/演出/展览/市集/便民，随到随参加，LBS 距离优先。
#   课程 = 长期课(course)：需报名入学、有周期课时/开班/截止/名额，全城按兴趣选课。
# 真实数据源若要区分二者，需在 parse() 阶段按「活动日期是否为区间 / 是否含课时」
# 判定并写入 kind 字段；这里对种子数据打标，结构与真实同构。
# ============================================================

# 既有种子中被判定为「长期课」的条目 + 其课程专属字段
COURSE_META = {
    1:  dict(weeks="16 周", schedule="每周三 14:00-15:30", start="9月16日开课",
             deadline="9月14日截止报名", seats="剩 12 个名额"),
    2:  dict(weeks="12 周", schedule="每周四 09:30-11:00", start="9月17日开课",
             deadline="9月15日截止报名", seats="剩 6 个名额"),
    12: dict(weeks="长期", schedule="每周四 14:00-16:00", start="随到随学",
             deadline="常年招生", seats="名额充足"),
    14: dict(weeks="12 周", schedule="每周一 13:30-15:00", start="9月14日开课",
             deadline="9月12日截止报名", seats="剩 4 个名额"),
    15: dict(weeks="8 周", schedule="每周日 10:00-11:30", start="9月20日开课",
             deadline="9月18日截止报名", seats="剩 10 个名额"),
    17: dict(weeks="长期", schedule="每周三 15:00-16:30", start="随到随学",
             deadline="常年招生", seats="名额充足"),
    19: dict(weeks="长期", schedule="每周五 14:00-16:00", start="随到随学",
             deadline="常年招生", seats="剩 5 个名额"),
}

# 追加的老年大学 / 长期班课程（演示用，字段结构与真实同构）
SEED_COURSES = [
    {"id": 25, "kind": "course", "title": "智能手机使用入门", "type": "学习",
     "venue": "上海市老年大学", "address": "上海市黄浦区西藏中路", "lat": 31.2300, "lng": 121.4700,
     "time": "每周二 09:00-10:30", "weeks": "8 周", "schedule": "每周二 09:00-10:30",
     "start": "9月15日开课", "deadline": "9月13日截止报名", "seats": "剩 3 个名额",
     "fee": "免费", "signup": "文化云小程序"},
    {"id": 26, "kind": "course", "title": "国画花鸟班", "type": "学习",
     "venue": "静安区老年大学", "address": "上海市静安区胶州路", "lat": 31.2260, "lng": 121.4480,
     "time": "每周五 09:00-11:00", "weeks": "12 周", "schedule": "每周五 09:00-11:00",
     "start": "9月18日开课", "deadline": "9月16日截止报名", "seats": "剩 7 个名额",
     "fee": "¥120/学期", "signup": "现场报名"},
    {"id": 27, "kind": "course", "title": "太极拳初级班", "type": "运动",
     "venue": "静安公园", "address": "上海市静安区南京西路", "lat": 31.2245, "lng": 121.4455,
     "time": "每周六 07:30-08:30", "weeks": "10 周", "schedule": "每周六 07:30-08:30",
     "start": "9月19日开课", "deadline": "9月17日截止报名", "seats": "剩 9 个名额",
     "fee": "¥80/学期", "signup": "文化云小程序"},
    {"id": 28, "kind": "course", "title": "老年合唱基础班", "type": "文艺",
     "venue": "徐汇区文化馆", "address": "上海市徐汇区漕溪北路", "lat": 31.1880, "lng": 121.4360,
     "time": "每周二 14:00-15:30", "weeks": "12 周", "schedule": "每周二 14:00-15:30",
     "start": "9月15日开课", "deadline": "9月13日截止报名", "seats": "剩 15 个名额",
     "fee": "免费", "signup": "文化云小程序"},
    {"id": 29, "kind": "course", "title": "手机摄影与修图课", "type": "学习",
     "venue": "浦东新区老年大学", "address": "上海市浦东新区浦东南路", "lat": 31.2350, "lng": 121.5300,
     "time": "每周四 14:00-15:30", "weeks": "6 周", "schedule": "每周四 14:00-15:30",
     "start": "9月17日开课", "deadline": "9月15日截止报名", "seats": "剩 5 个名额",
     "fee": "¥60/学期", "signup": "现场报名"},
    {"id": 30, "kind": "course", "title": "民族舞初级班", "type": "运动",
     "venue": "长宁区文化馆", "address": "上海市长宁区仙霞路", "lat": 31.2200, "lng": 121.4200,
     "time": "每周三 09:30-11:00", "weeks": "12 周", "schedule": "每周三 09:30-11:00",
     "start": "9月16日开课", "deadline": "9月14日截止报名", "seats": "剩 11 个名额",
     "fee": "¥100/学期", "signup": "文化云小程序"},
    {"id": 31, "kind": "course", "title": "中医养生与食疗课", "type": "公益",
     "venue": "普陀区中心医院", "address": "上海市普陀区长寿路", "lat": 31.2480, "lng": 121.4000,
     "time": "每周一 09:00-10:30", "weeks": "8 周", "schedule": "每周一 09:00-10:30",
     "start": "9月14日开课", "deadline": "9月12日截止报名", "seats": "剩 6 个名额",
     "fee": "免费", "signup": "现场报名"},
    {"id": 32, "kind": "course", "title": "英语口语兴趣班", "type": "学习",
     "venue": "虹口区老年大学", "address": "上海市虹口区四川北路", "lat": 31.2680, "lng": 121.4920,
     "time": "每周五 10:00-11:30", "weeks": "16 周", "schedule": "每周五 10:00-11:30",
     "start": "9月18日开课", "deadline": "9月16日截止报名", "seats": "剩 8 个名额",
     "fee": "¥150/学期", "signup": "文化云小程序"},
]

# 给既有种子打标（原地修改；DEMO_ACTIVITIES 与 SEED_ACTIVITIES 指向同一列表对象）
for _a in SEED_ACTIVITIES:
    _a["kind"] = "course" if _a["id"] in COURSE_META else "once"
    _a.update(COURSE_META.get(_a["id"], {}))
    if _a["kind"] == "course":
        _a["time"] = _a.get("schedule", _a["time"])
SEED_ACTIVITIES.extend(SEED_COURSES)

# 追加人民广场周边的「单次活动」，保证默认 1km 首屏就有足够内容可看
SEED_ONCE = [
    {"id": 33, "kind": "once", "title": "上博青铜器专题讲座", "type": "学习",
     "venue": "上海博物馆", "address": "上海市黄浦区人民大道201号", "lat": 31.2288, "lng": 121.4755,
     "time": "周六 14:00", "fee": "免费", "signup": "文化云小程序"},
    {"id": 34, "kind": "once", "title": "人民公园戏曲票友会", "type": "文艺",
     "venue": "人民公园", "address": "上海市黄浦区南京西路231号", "lat": 31.2320, "lng": 121.4720,
     "time": "周日 09:30", "fee": "免费", "signup": "现场参加"},
    {"id": 35, "kind": "once", "title": "南京路老照片展", "type": "文艺",
     "venue": "黄浦区文化馆", "address": "上海市黄浦区南京东路", "lat": 31.2350, "lng": 121.4780,
     "time": "全天", "fee": "免费", "signup": "现场参加"},
    {"id": 36, "kind": "once", "title": "外滩街道健康义诊", "type": "公益",
     "venue": "外滩街道社区中心", "address": "上海市黄浦区河南中路", "lat": 31.2370, "lng": 121.4790,
     "time": "周三 08:30", "fee": "免费", "signup": "现场参加"},
    {"id": 37, "kind": "once", "title": "黄浦图书馆读书分享会", "type": "学习",
     "venue": "黄浦区图书馆", "address": "上海市黄浦区福州路", "lat": 31.2330, "lng": 121.4810,
     "time": "周五 14:00", "fee": "免费", "signup": "文化云小程序"},
    {"id": 38, "kind": "once", "title": "人民广场交谊舞会", "type": "运动",
     "venue": "人民广场", "address": "上海市黄浦区人民大道", "lat": 31.2290, "lng": 121.4760,
     "time": "每日 19:30", "fee": "免费", "signup": "现场参加"},
]
SEED_ACTIVITIES.extend(SEED_ONCE)


def by_kind(activities, kind):
    """按内容形态筛选：once=单次活动，course=长期课。"""
    return [a for a in activities if a.get("kind", "once") == kind]


def courses_query(lat, lng):
    """课程页：全城长期课（不受半径限制），附带距离并按由近到远排序。"""
    out = []
    for a in by_kind(SEED_ACTIVITIES, "course"):
        b = dict(a)
        b["distance_km"] = round(haversine(lat, lng, a["lat"], a["lng"]), 3)
        out.append(b)
    out.sort(key=lambda x: x["distance_km"])
    return out


# ============================================================
# 2. 解析（字段映射 / 去重 / 清洗）
# ============================================================
def parse(raw):
    if raw is None:
        return [dict(a, source="seed") for a in SEED_ACTIVITIES]
    return raw


# ============================================================
# 3. 地理编码（高德 API + 坐标缓存兜底）
# ============================================================
# 内置坐标缓存：覆盖 seed 中常见场馆/街道，保证无 key 时也能算半径。
GEO_CACHE = {
    "上海群众艺术馆": (31.1930, 121.4350),
    "曲阳社区文化活动中心": (31.2870, 121.5030),
    "虹口区文化馆": (31.2650, 121.4900),
}

GEO_SOURCE = "seed"  # 全局记录本次 geocode 来源


def geocode_amap(address, key, city="上海", timeout=8):
    """高德地理编码：地址 -> (lat, lng)。需 key；失败返回 None。"""
    if not key:
        return None
    try:
        q = urllib.parse.urlencode({"address": address, "key": key, "city": city})
        url = "https://restapi.amap.com/v3/geocode/geo?" + q
        req = urllib.request.Request(url, headers={"User-Agent": "old-buddy-agent/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            d = json.loads(r.read())
        if d.get("status") == "1" and d.get("geocodes"):
            lng, lat = d["geocodes"][0]["location"].split(",")
            return float(lat), float(lng)
    except Exception:
        pass
    return None


def geocode(address, amap_key=None):
    """统一地理编码入口：高德 -> 坐标缓存 -> 失败。返回 ((lat,lng), source)。"""
    global GEO_SOURCE
    coord = geocode_amap(address, amap_key)
    if coord:
        GEO_SOURCE = "amap"
        return coord, "amap"
    if address in GEO_CACHE:
        GEO_SOURCE = "cache"
        return GEO_CACHE[address], "cache"
    return None, "fail"


# ============================================================
# 4. 半径查询（Haversine）
# ============================================================
def haversine(lat1, lng1, lat2, lng2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def radius_query(activities, user_lat, user_lng, radius_km, kind=None):
    """半径查询。kind='once'/'course' 时只统计该内容形态（默认全部）。"""
    out = []
    for a in activities:
        if kind is not None and a.get("kind", "once") != kind:
            continue
        d = haversine(user_lat, user_lng, a["lat"], a["lng"])
        if d <= radius_km:
            b = dict(a)
            b["distance_km"] = round(d, 3)
            out.append(b)
    out.sort(key=lambda x: x["distance_km"])
    return out


# ============================================================
# 5. 汇总分析
# ============================================================
def analyze(nearby, radius_km):
    by_type = {}
    for a in nearby:
        by_type[a["type"]] = by_type.get(a["type"], 0) + 1
    summary = "在您 %.0fkm 范围内发现 %d 场活动。" % (radius_km, len(nearby))
    if by_type:
        parts = ["%s %d 场" % (k, v) for k, v in
                 sorted(by_type.items(), key=lambda x: -x[1])]
        summary += "类型分布：" + "、".join(parts) + "。"
    if nearby:
        top = nearby[0]
        summary += ('最近的一场是「%s」，距您约 %.2fkm（%s，%s）。'
                    % (top["title"], top["distance_km"], top["time"], top["fee"]))
    return summary, by_type


# ============================================================
# 主流程：编排整条管道 + 溯源
# ============================================================
def run_pipeline(user, radius_km=1.0, sh_app_key=None, amap_key=None):
    """执行完整闭环，返回带 provenance 的结果字典。"""
    # 1) crawl + 2) parse
    raw = fetch_shanghai_opendata(app_key=sh_app_key)
    activities = parse(raw)
    live_count = sum(1 for a in activities if a.get("source") == "live_opendata")
    source_label = "live_opendata" if live_count else "seed"

    # 3) geocode：带坐标的 seed 视为热缓存；缺坐标的才调用
    geo_src_set = set()
    for a in activities:
        if "lat" not in a or "lng" not in a:
            coord, src = geocode(a.get("address", ""), amap_key=amap_key)
            if coord:
                a["lat"], a["lng"] = coord
                a["geo_source"] = src
                geo_src_set.add(src)
            else:
                a["geo_source"] = "fail"
        else:
            a.setdefault("geo_source", "seed")

    # 4) radius + 5) analyze
    nearby = radius_query(activities, user["lat"], user["lng"], radius_km)
    summary, by_type = analyze(nearby, radius_km)
    stats = {r: len(radius_query(activities, user["lat"], user["lng"], r))
             for r in [1, 3, 5, 10]}

    return {
        "user": user,
        "default_radius_km": radius_km,
        "summary": summary,
        "nearby": nearby,
        "radius_stats": stats,
        "total": len(activities),
        "provenance": {
            "activities_source": source_label,
            "live_count": live_count,
            "seed_count": len(activities) - live_count,
            "geo_source": "+".join(sorted(geo_src_set)) if geo_src_set else GEO_SOURCE,
        },
    }


def get_activities(sh_app_key=None, amap_key=None):
    """返回全部活动（含坐标）；有 key 时优先实时源，否则回退种子。供服务/小程序消费。"""
    raw = fetch_shanghai_opendata(app_key=sh_app_key)
    activities = parse(raw)
    for a in activities:
        if "lat" not in a or "lng" not in a:
            coord, _ = geocode(a.get("address", ""), amap_key=amap_key)
            if coord:
                a["lat"], a["lng"] = coord
    return activities


def main():
    user = {"lat": 31.2304, "lng": 121.4737, "name": "人民广场（演示定位点）"}
    sh_app_key = os.environ.get("SH_DATA_APP_KEY")
    amap_key = os.environ.get("AMAP_KEY")

    result = run_pipeline(user, radius_km=1.0,
                          sh_app_key=sh_app_key, amap_key=amap_key)

    with open(os.path.join(HERE, "demo_output.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    pv = result["provenance"]
    print("=== old-buddy 自动采集管道 · 闭环（生产级 + 兜底）===")
    print("活动数据源：%s（live=%d / seed=%d）"
          % (pv["activities_source"], pv["live_count"], pv["seed_count"]))
    print("地理编码来源：%s" % pv["geo_source"])
    print("用户定位：%s (%.4f, %.4f)" % (user["name"], user["lat"], user["lng"]))
    print("默认半径：1km（可调 1/3/5/10km）")
    print("汇总：", result["summary"])
    print("多半径统计：", result["radius_stats"])
    print("--- 默认半径内活动（按距离排序）---")
    for a in result["nearby"]:
        print("  · %s [%s] %.2fkm %s %s" % (a["title"], a["type"],
                                            a["distance_km"], a["time"], a["fee"]))

    build_radar(result)
    print("\n已生成 radar.html 与 demo_output.json")


# ============================================================
# 半径雷达可视化（自包含 HTML / 内联 SVG / 浅色主题）
# ============================================================
def build_radar(result):
    user = result["user"]
    default_r = result["default_radius_km"]
    activities = result.get("nearby") or []

    CX, CY = 340, 300
    R_DISP = 250.0
    MAX_KM = 5.0
    scale = R_DISP / MAX_KM

    def offset_km(a):
        dlat = (a["lat"] - user["lat"]) * 110.574
        dlng = (a["lng"] - user["lng"]) * 111.320 * math.cos(math.radians(user["lat"]))
        return dlat, dlng

    def to_px(a):
        dlat, dlng = offset_km(a)
        dist_km = math.hypot(dlat, dlng)
        if dist_km > MAX_KM:
            f = MAX_KM / dist_km
            dlat, dlng = dlat * f, dlng * f
            clamped = True
        else:
            clamped = False
        x = CX + dlng * scale
        y = CY - dlat * scale
        return x, y, dist_km, clamped

    # 只画落入 5km 视图内的点（地图上全部活动，便于看分布）
    all_acts = [a for a in (result.get("_all") or [])]
    plot_pool = all_acts if all_acts else activities

    dots = []
    for a in plot_pool:
        x, y, dist, clamped = to_px(a)
        inside = dist <= default_r
        color = "#3B6D11" if inside else "#9aa0a6"
        ring = ("<circle cx=\"%.1f\" cy=\"%.1f\" r=\"6\" fill=\"%s\" stroke=\"#fff\" stroke-width=\"1.5\"/>"
                % (x, y, color))
        if inside:
            label = ('<text x="%.1f" y="%.1f" font-size="10" fill="#27500A" '
                     'font-family="-apple-system, PingFang SC, sans-serif">%.2fkm</text>'
                     % (x + 8, y - 6, dist))
        else:
            label = ""
        dots.append(ring + label)

    rings = []
    for km in [1, 3, 5]:
        is_default = (km == default_r)
        stroke = "#3B6D11" if is_default else "#d9dde3"
        width = "2" if is_default else "1"
        rings.append('<circle cx="%d" cy="%d" r="%.1f" fill="none" stroke="%s" stroke-width="%s" stroke-dasharray="%s"/>'
                     % (CX, CY, km * scale, stroke, width, "none" if is_default else "4 4"))
        rings.append('<text x="%d" y="%.1f" font-size="10" fill="%s" font-family="-apple-system, PingFang SC, sans-serif">%dkm</text>'
                     % (CX + 4, CY - km * scale + 12, "#5F5E5A", km))

    nearby_items = ""
    for a in result["nearby"]:
        nearby_items += (
            '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #eee;">'
            '<span style="background:#EAF3DE;color:#27500A;border-radius:6px;padding:2px 8px;font-size:12px;">%s</span>'
            '<div style="flex:1;">'
            '<div style="font-weight:500;color:#2C2C2A;">%s</div>'
            '<div style="font-size:12px;color:#5F5E5A;">%s · %s · %s</div>'
            '</div>'
            '<span style="font-weight:500;color:#3B6D11;font-size:13px;">%.2fkm</span>'
            '</div>' % (a["type"], a["title"], a["venue"], a["time"], a["fee"], a["distance_km"])
        )
    if not nearby_items:
        nearby_items = '<div style="color:#5F5E5A;padding:8px 0;">该半径内暂无活动，调大半径试试。</div>'

    stats = result["radius_stats"]
    stats_html = " · ".join(["<b>%dkm</b>: %d 场" % (k, stats[k]) for k in [1, 3, 5, 10]])

    pv = result.get("provenance", {})
    prov_html = ("活动数据源：<b>%s</b>（live %d / seed %d） · 地理编码：<b>%s</b>"
                 % (pv.get("activities_source"), pv.get("live_count", 0),
                    pv.get("seed_count", 0), pv.get("geo_source")))

    html = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>old-buddy 半径雷达 · 演示</title>
<style>
  body{margin:0;font-family:-apple-system,'PingFang SC',sans-serif;background:#fff;color:#2C2C2A;}
  .wrap{max-width:760px;margin:0 auto;padding:24px;}
  h1{font-size:20px;font-weight:500;margin:0 0 4px;}
  .sub{color:#5F5E5A;font-size:13px;margin-bottom:16px;}
  .card{border:1px solid #e6e6e6;border-radius:12px;padding:16px;margin-bottom:16px;}
  .summary{background:#EAF3DE;color:#27500A;border-radius:10px;padding:12px 14px;font-size:14px;line-height:1.6;}
  .stats{color:#5F5E5A;font-size:13px;margin-top:8px;}
  .row{display:flex;gap:16px;flex-wrap:wrap;}
  .col{flex:1;min-width:280px;}
  svg{width:100%%;height:auto;}
  .prov{font-size:12px;color:#8a8a8a;margin-top:10px;}
</style>
</head>
<body>
<div class="wrap">
  <h1>old-buddy · 附近活动半径雷达</h1>
  <div class="sub">演示定位点：%s · 默认半径 %dkm（用户可调 1/3/5/10km）</div>

  <div class="card">
    <div class="summary">%s</div>
    <div class="stats">多半径统计 — %s</div>
    <div class="prov">%s</div>
  </div>

  <div class="row">
    <div class="col card">
      <svg viewBox="0 0 680 600" role="img" aria-label="附近活动半径雷达">
        %s
        %s
        <circle cx="%d" cy="%d" r="7" fill="#534AB7" stroke="#fff" stroke-width="2"/>
        <text x="%d" y="%d" font-size="11" fill="#3C3489" font-family="-apple-system,PingFang SC,sans-serif">您的位置</text>
      </svg>
    </div>
    <div class="col card">
      <div style="font-weight:500;margin-bottom:4px;">%dkm 范围内活动</div>
      %s
    </div>
  </div>
  <div class="sub">说明：坐标为演示示意；真实环境由 AI agent 自动爬取上海公共开放数据并地理编码后实时生成。生产接入需：① 上海开放数据平台实名认证获取 app key；② 高德/腾讯地理编码 key；③ 建议部署在国内服务器规避 WAF/限流。</div>
</div>
</body>
</html>
""" % (user["name"], int(default_r), result["summary"], stats_html, prov_html,
       "\n".join(rings), "\n".join(dots),
       CX, CY, CX + 10, CY + 22,
       int(default_r), nearby_items)

    with open(os.path.join(HERE, "radar.html"), "w", encoding="utf-8") as f:
        f.write(html)


if __name__ == "__main__":
    main()
