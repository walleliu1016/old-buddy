#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""old-buddy v2 服务：托管可视图原型 + 提供 /nearby 数据接口（内置降级，离线可跑）。"""
import sys, os, json, math
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from functools import partial

HERE = os.path.dirname(os.path.abspath(__file__))
PIPELINE_DIR = os.path.join(HERE, "..", "pipeline-demo")
sys.path.insert(0, os.path.abspath(PIPELINE_DIR))

import oldbuddy_pipeline as ob  # DEMO_ACTIVITIES, radius_query, run_pipeline, get_activities

PORT = 8789
RADII = [1, 3, 5, 10]
DEFAULT_USER = {"lat": 31.2304, "lng": 121.4737, "name": "人民广场"}


def build_stats(lat, lng):
    """「附近」页只统计单次活动(once)。"""
    return {str(r): len(ob.radius_query(ob.DEMO_ACTIVITIES, lat, lng, r, kind="once"))
            for r in RADII}


def make_response(lat, lng, radius, name):
    nearby = ob.radius_query(ob.DEMO_ACTIVITIES, lat, lng, radius, kind="once")
    return {
        "count": len(nearby),
        "user": {"lat": lat, "lng": lng, "name": name},
        "radius_km": radius,
        "stats": build_stats(lat, lng),
        "nearby": nearby,
    }


def make_courses(lat, lng, name):
    """「课程」页：全城长期课，不受半径限制，按距离由近到远。"""
    courses = ob.courses_query(lat, lng)
    return {
        "count": len(courses),
        "user": {"lat": lat, "lng": lng, "name": name},
        "courses": courses,
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=HERE, **kw)

    def _send(self, code, ctype, body_bytes):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body_bytes)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/nearby":
            q = parse_qs(parsed.query)
            try:
                lat = float(q.get("lat", [DEFAULT_USER["lat"]])[0])
                lng = float(q.get("lng", [DEFAULT_USER["lng"]])[0])
                radius = float(q.get("radius", [1])[0])
                name = q.get("name", [DEFAULT_USER["name"]])[0]
            except Exception:
                lat, lng, radius, name = DEFAULT_USER["lat"], DEFAULT_USER["lng"], 1, DEFAULT_USER["name"]
            data = make_response(lat, lng, radius, name)
            self._send(200, "application/json; charset=utf-8",
                       json.dumps(data, ensure_ascii=False).encode("utf-8"))
            return
        if parsed.path == "/courses":
            q = parse_qs(parsed.query)
            try:
                lat = float(q.get("lat", [DEFAULT_USER["lat"]])[0])
                lng = float(q.get("lng", [DEFAULT_USER["lng"]])[0])
                name = q.get("name", [DEFAULT_USER["name"]])[0]
            except Exception:
                lat, lng, name = DEFAULT_USER["lat"], DEFAULT_USER["lng"], DEFAULT_USER["name"]
            self._send(200, "application/json; charset=utf-8",
                       json.dumps(make_courses(lat, lng, name), ensure_ascii=False).encode("utf-8"))
            return
        if parsed.path == "/refresh":
            # 真实环境：触发 fetch_* 适配器；此处返回溯源状态
            try:
                res = ob.get_activities()
                mode = "live" if res.get("provenance") == "live" else "seed"
            except Exception:
                mode = "seed"
            self._send(200, "application/json; charset=utf-8",
                       json.dumps({"ok": True, "mode": mode,
                                   "note": "演示用种子数据；接上海开放数据 app key + 高德 key 即切 live"},
                                  ensure_ascii=False).encode("utf-8"))
            return
        # 静态资源
        super().do_GET()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"old-buddy v2 已启动: http://0.0.0.0:{PORT}  (LAN: http://192.168.31.136:{PORT})")
    srv.serve_forever()
