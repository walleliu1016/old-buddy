#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
老友时光 · 自有数据工厂（爬虫 + AI 汇总）—— 对外服务版
=====================================================================
部署：国内服务器（规避上海开放平台 WAF / 高德限流）

架构定位（重要）：
  本服务**只负责生产数据**，不直接写微信云数据库。
  由微信云函数 `sync`（定时触发器）主动来拉，再 upsert 进云数据库。
  => 好处：CloudBase 密钥不用离开微信环境，更安全，也少一套鉴权。

对外接口：
  GET  /api/v1/activities?limit=200   归一化+地理编码+AI改写后的活动列表（云函数来拉这个）
  GET  /api/v1/summary?scope=city&scopeKey=上海&period=week   AI 汇总导语
  POST /api/v1/sync                   手动触发重新采集（需 X-Admin-Key）
  GET  /api/v1/health

环境变量：
  SH_DATA_APP_KEY   上海公共数据开放平台 app key（需实名认证）
  AMAP_KEY          高德地理编码 key
  LLM_API_KEY       LLM key（混元/通义/DeepSeek 等 OpenAI 兼容接口）
  LLM_BASE          LLM base_url，默认腾讯云混元
  LLM_MODEL         模型名，默认 hunyuan-standard
  ADMIN_KEY         /api/v1/sync 鉴权，默认 secret
  PORT              端口，默认 8800

启动：pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port 8800
"""
import os, json, math, time, hashlib
import urllib.parse, urllib.request
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="old-buddy data-factory", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ============================================================
# 内存缓存（采集结果；生产可换 Redis）
# ============================================================
CACHE: Dict[str, Any] = {
    "records": [],        # 归一化后的活动列表
    "summaries": {},      # key=f"{scope}:{scopeKey}:{period}" -> 文案
    "updated_at": None,
    "provenance": {"activities_source": "none", "geo_source": "none"},
}
CACHE_TTL = int(os.environ.get("CACHE_TTL", 3600))  # 秒


# ============================================================
# 1. 数据源适配器
# ============================================================
SH_DATASETS = {
    "hongkou_jiangwan": "O2813839692025032",
    "culture_centers": "O8065471362025044",
}
SH_BASE = "https://data.sh.gov.cn/api/0500/v1/datasets/{id}/records"


def fetch_shanghai_opendata(app_key: str, dataset_key: str = "hongkou_jiangwan", limit: int = 200):
    """拉取上海公共数据开放平台。需实名 app key；失败返回 None 由调用方兜底。"""
    if not app_key:
        return None
    ds = SH_DATASETS.get(dataset_key)
    if not ds:
        return None
    url = SH_BASE.format(id=ds) + "?" + urllib.parse.urlencode({"offset": 0, "limit": limit})
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "old-buddy-agent/1.0", "Accept": "application/json",
            "X-App-Key": app_key, "Referer": "https://data.sh.gov.cn/"})
        with urllib.request.urlopen(req, timeout=15) as r:
            if r.status != 200:
                return None
            return [normalize_row(x) for x in json.loads(r.read()).get("data", [])]
    except Exception:
        return None


def normalize_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """开放平台记录 -> 统一活动对象（kind 稍后判定）。"""
    return {
        "title": row.get("hdmc") or row.get("活动名称") or "未命名活动",
        "category": row.get("type") or "公益",
        "venue": row.get("hddd") or "",
        "address": row.get("hddd") or "",
        "timeText": row.get("hdrq") or row.get("活动日期") or "待定",
        "fee": "免费", "price": 0, "signupType": "onsite",
        "organizer": row.get("ssjd") or "", "district": row.get("ssjd") or "",
        "source": "live_opendata",
    }


# 种子兜底（与真实接口同构；无 key / 被 WAF 拦时使用）
SEED: List[Dict[str, Any]] = [
    {"title": "市民合唱团招新", "category": "文艺", "venue": "上海音乐厅",
     "address": "上海市黄浦区延安东路523号", "timeText": "周三 14:00",
     "fee": "免费", "price": 0, "district": "黄浦", "organizer": "黄浦区文化馆"},
    {"title": "上博青铜器专题讲座", "category": "学习", "venue": "上海博物馆",
     "address": "上海市黄浦区人民大道201号", "timeText": "周六 14:00",
     "fee": "免费", "price": 0, "district": "黄浦", "organizer": "上海博物馆"},
    {"title": "外滩故事会", "category": "公益", "venue": "外滩历史纪念馆",
     "address": "上海市黄浦区中山东一路", "timeText": "周六 10:00",
     "fee": "免费", "price": 0, "district": "黄浦", "organizer": "外滩街道"},
    {"title": "智能手机使用入门", "category": "学习", "venue": "上海市老年大学",
     "address": "上海市黄浦区西藏中路", "timeText": "每周二 09:00-10:30",
     "fee": "免费", "price": 0, "district": "黄浦", "organizer": "上海市老年大学",
     "weeks": "8 周", "schedule": "每周二 09:00-10:30", "startText": "9月15日开课",
     "deadline": "9月13日截止报名", "seatsText": "剩 3 个名额"},
    {"title": "国画花鸟班", "category": "学习", "venue": "静安区老年大学",
     "address": "上海市静安区胶州路", "timeText": "每周五 09:00-11:00",
     "fee": "¥120/学期", "price": 12000, "district": "静安", "organizer": "静安区老年大学",
     "weeks": "12 周", "schedule": "每周五 09:00-11:00", "startText": "9月18日开课",
     "deadline": "9月16日截止报名", "seatsText": "剩 7 个名额"},
    {"title": "太极拳初级班", "category": "运动", "venue": "静安公园",
     "address": "上海市静安区南京西路", "timeText": "每周六 07:30-08:30",
     "fee": "¥80/学期", "price": 8000, "district": "静安", "organizer": "静安区文化馆",
     "weeks": "10 周", "schedule": "每周六 07:30-08:30", "startText": "9月19日开课",
     "deadline": "9月17日截止报名", "seatsText": "剩 9 个名额"},
]


# ============================================================
# 2. 解析 / 去重 / kind 判定
# ============================================================
def detect_kind(rec: Dict[str, Any]) -> str:
    """按「是否含周次/课时/开课/截止报名/学期」判定长期课。"""
    txt = " ".join(str(rec.get(k, "")) for k in ("weeks", "schedule", "startText", "deadline", "semesterFee"))
    return "course" if any(k in txt for k in ("周", "课时", "开课", "截止报名", "学期")) else "once"


def ext_id(rec: Dict[str, Any]) -> str:
    """稳定外部 ID，供云函数幂等 upsert。"""
    raw = f"{rec.get('title','')}|{rec.get('venue','')}|{rec.get('timeText','')}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def dedupe(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen, out = set(), []
    for r in records:
        k = ext_id(r)
        if k in seen:
            continue
        seen.add(k)
        r["extId"] = k
        out.append(r)
    return out


# ============================================================
# 3. 地理编码（高德 + 缓存兜底）
# ============================================================
GEO_CACHE = {
    "上海音乐厅": (31.2250, 121.4730),
    "上海博物馆": (31.2288, 121.4755),
    "外滩历史纪念馆": (31.2397, 121.4900),
    "上海市老年大学": (31.2300, 121.4700),
    "静安区老年大学": (31.2260, 121.4480),
    "静安公园": (31.2245, 121.4455),
}


# 区级兜底中心点：地理编码全失败时保证活动不丢（宁可位置略偏，也不能没有内容）
DISTRICT_CENTROID = {
    "黄浦": (31.2317, 121.4844), "静安": (31.2288, 121.4453),
    "徐汇": (31.1885, 121.4365), "长宁": (31.2204, 121.4207),
    "普陀": (31.2495, 121.3970), "虹口": (31.2653, 121.4907),
    "杨浦": (31.2595, 121.5223), "浦东": (31.2216, 121.5445),
}


def geocode(address: str, venue: str = "", amap_key: Optional[str] = None, district: str = ""):
    """返回 (lat, lng, geo_source)。

    依次尝试：高德(地址→场馆) -> 坐标缓存(地址→场馆) -> 区级中心点 -> 失败。
    """
    candidates = [c for c in (address, venue) if c]
    if amap_key:
        for c in candidates:
            try:
                q = urllib.parse.urlencode({"address": c, "key": amap_key, "city": "上海"})
                with urllib.request.urlopen(
                    f"https://restapi.amap.com/v3/geocode/geo?{q}", timeout=8) as r:
                    d = json.loads(r.read())
                if d.get("status") == "1" and d.get("geocodes"):
                    lng, lat = d["geocodes"][0]["location"].split(",")
                    return float(lat), float(lng), "amap"
            except Exception:
                continue
    for c in candidates:
        if c in GEO_CACHE:
            lat, lng = GEO_CACHE[c]
            return lat, lng, "cache"
    if district and district in DISTRICT_CENTROID:
        lat, lng = DISTRICT_CENTROID[district]
        return lat, lng, "district"
    return None, None, "fail"


# ============================================================
# 4. AI：适老化改写 + 标签抽取 + 汇总导语
# ============================================================
def get_llm():
    key = os.environ.get("LLM_API_KEY")
    if not key:
        return None
    try:
        from openai import OpenAI
        return OpenAI(api_key=key, base_url=os.environ.get("LLM_BASE", "https://api.hunyuan.cloud.tencent.com/v1"))
    except Exception:
        return None


def ai_enrich(rec: Dict[str, Any], client) -> Dict[str, Any]:
    """把活动信息改写成退休老人一眼能懂的大白话，并抽 2-3 个标签。"""
    rec.setdefault("description", "")
    rec.setdefault("aiTags", [])
    if not client:
        return rec
    prompt = (
        "你是社区适老化助手。把下面的活动改写成退休老人一眼能懂的大白话（40字内），"
        "并提取 2-3 个短标签（如「免费」「适合初学者」「要交材料费」）。\n"
        "只返回一个 JSON，不要解释：{\"desc\":\"...\",\"tags\":[\"...\"]}\n"
        f"标题：{rec.get('title','')}\n时间：{rec.get('timeText','')}\n"
        f"费用：{rec.get('fee','')}\n地点：{rec.get('venue','')}"
    )
    try:
        resp = client.chat.completions.create(
            model=os.environ.get("LLM_MODEL", "hunyuan-standard"),
            messages=[{"role": "user", "content": prompt}], temperature=0.3, timeout=20)
        txt = resp.choices[0].message.content.strip()
        txt = txt[txt.find("{"):txt.rfind("}") + 1] if "{" in txt else txt
        j = json.loads(txt)
        rec["description"] = j.get("desc") or rec["description"]
        rec["aiTags"] = j.get("tags") or rec["aiTags"]
    except Exception:
        pass
    return rec


def ai_summary(records: List[Dict[str, Any]], scope_key: str, client) -> Optional[Dict[str, Any]]:
    if not client or not records:
        return None
    top = records[:5]
    prompt = (f"为{scope_key}的退休朋友写一句本周活动推荐导语（大白话，40字以内，不要标题党）。"
              f"可参考这几场：{', '.join(r.get('title','') for r in top)}")
    try:
        resp = client.chat.completions.create(
            model=os.environ.get("LLM_MODEL", "hunyuan-standard"),
            messages=[{"role": "user", "content": prompt}], temperature=0.5, timeout=20)
        content = resp.choices[0].message.content.strip()
        return {"scope": "city", "scopeKey": scope_key, "period": "week",
                "content": content,
                "topActivityIds": [r.get("extId", "") for r in top[:3]],
                "model": os.environ.get("LLM_MODEL", "hunyuan-standard")}
    except Exception:
        return None


# ============================================================
# 5. 编排：采集 -> 解析 -> 地理编码 -> AI
# ============================================================
def run_pipeline(force: bool = False):
    """执行一次完整采集，结果写入 CACHE。"""
    if (not force) and CACHE["records"] and CACHE["updated_at"]:
        age = (datetime.now() - CACHE["updated_at"]).total_seconds()
        if age < CACHE_TTL:
            return {"cached": True, "age_seconds": int(age)}

    sh_key = os.environ.get("SH_DATA_APP_KEY")
    amap_key = os.environ.get("AMAP_KEY")
    client = get_llm()

    raw = fetch_shanghai_opendata(sh_key) if sh_key else None
    source = "live_opendata" if raw else "seed"
    recs = dedupe(raw if raw else [dict(r) for r in SEED])

    geo_src = set()
    for r in recs:
        r["kind"] = detect_kind(r)
        lat, lng, gsrc = geocode(r.get("address", ""), r.get("venue", ""), amap_key, r.get("district", ""))
        r["lat"] = lat
        r["lng"] = lng
        r["geoSource"] = gsrc
        geo_src.add(gsrc)

    # AI 改写（无 key 时自动跳过，保留原文）
    for r in recs:
        ai_enrich(r, client)

    CACHE["records"] = [r for r in recs if r.get("lat") is not None]
    CACHE["updated_at"] = datetime.now()
    CACHE["provenance"] = {
        "activities_source": source,
        "geo_source": "+".join(sorted(geo_src)) if geo_src else "none",
        "ai_enabled": bool(client),
    }

    # AI 汇总导语
    summary = ai_summary(CACHE["records"], "上海", client)
    if summary:
        CACHE["summaries"][f"city:上海:week"] = summary

    return {"cached": False, "fetched": len(raw or []), "kept": len(CACHE["records"]),
            "provenance": CACHE["provenance"]}


# ============================================================
# 6. 接口
# ============================================================
def public_record(r: Dict[str, Any]) -> Dict[str, Any]:
    """输出给云函数的字段（扁平 lat/lng，便于云函数构造 GeoPoint）。"""
    return {
        "extId": r.get("extId", ""),
        "kind": r.get("kind", "once"),
        "title": r.get("title", ""),
        "category": r.get("category", "公益"),
        "venue": r.get("venue", ""),
        "address": r.get("address", ""),
        "lat": r.get("lat"),
        "lng": r.get("lng"),
        "timeText": r.get("timeText", "待定"),
        "fee": r.get("fee", "免费"),
        "price": r.get("price", 0),
        "signupType": r.get("signupType", "onsite"),
        "organizer": r.get("organizer", ""),
        "district": r.get("district", ""),
        "description": r.get("description", ""),
        "aiTags": r.get("aiTags", []),
        "source": r.get("source", "seed"),
        "geoSource": r.get("geoSource", "cache"),
        # 课程专属
        "weeks": r.get("weeks", ""), "schedule": r.get("schedule", ""),
        "startText": r.get("startText", ""), "deadline": r.get("deadline", ""),
        "seatsText": r.get("seatsText", ""), "semesterFee": r.get("semesterFee", ""),
        "level": r.get("level", ""),
    }


@app.on_event("startup")
async def on_start():
    try:
        run_pipeline(force=False)
    except Exception:
        pass


@app.get("/api/v1/activities")
def api_activities(limit: int = Query(200, ge=1, le=1000), kind: str = Query("")):
    """云函数 sync 来拉这个。返回归一化+地理编码+AI改写后的活动列表。"""
    run_pipeline(force=False)
    recs = CACHE["records"]
    if kind in ("once", "course"):
        recs = [r for r in recs if r.get("kind") == kind]
    return {"code": 0, "data": {
        "list": [public_record(r) for r in recs[:limit]],
        "count": min(len(recs), limit),
        "provenance": CACHE["provenance"],
        "updated_at": CACHE["updated_at"].isoformat() if CACHE["updated_at"] else None,
    }}


@app.get("/api/v1/summary")
def api_summary(scope: str = Query("city"), scopeKey: str = Query("上海"), period: str = Query("week")):
    """AI 汇总导语。"""
    run_pipeline(force=False)
    key = f"{scope}:{scopeKey}:{period}"
    s = CACHE["summaries"].get(key)
    if not s:
        s = ai_summary(CACHE["records"], scopeKey, get_llm())
        if s:
            CACHE["summaries"][key] = s
    if not s:
        return {"code": 0, "data": {"scope": scope, "scopeKey": scopeKey, "period": period,
                                    "content": "", "topActivityIds": []}}
    return {"code": 0, "data": s}


class SyncReq(BaseModel):
    force: bool = False
    sources: List[str] = ["sh_opendata"]


@app.post("/api/v1/sync")
def api_sync(req: SyncReq, x_admin_key: str = Header(None)):
    """手动触发重新采集（需 X-Admin-Key）。"""
    if x_admin_key != os.environ.get("ADMIN_KEY", "secret"):
        raise HTTPException(status_code=401, detail="unauthorized")
    t0 = time.time()
    res = run_pipeline(force=req.force)
    return {"code": 0, "data": dict(res, durationMs=int((time.time() - t0) * 1000),
                                    kept=len(CACHE["records"]))}


@app.get("/api/v1/health")
def health():
    return {"ok": True, "records": len(CACHE["records"]),
            "provenance": CACHE["provenance"],
            "ai_enabled": bool(os.environ.get("LLM_API_KEY"))}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8800)))
