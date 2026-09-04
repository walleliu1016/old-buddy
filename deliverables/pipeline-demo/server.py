#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
old-buddy 后端服务 + 小程序前端托管（零依赖、零烧钱）
- GET /                         -> 小程序前端（webapp/index.html）
- GET /static/*                 -> 前端静态资源（css/js）
- GET /nearby?lat=&lng=&radius= -> 返回附近活动 JSON（可调半径 1/3/5/10km）
- GET /refresh                  -> 触发一次采集，回报数据源溯源状态

前端（webapp/）是完整小程序原型：首页/分类/收藏/我的 四页 + 底部 Tab，
定位作为贯穿全产品的筛选主轴，适老化（大字模式/语音播报/防诈骗确认）。
真实环境：把 fetch_* 适配器接到 文化云 / 上海公共开放数据，geocode 接高德/腾讯，
前端无需改动。
"""

import json
import os
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from oldbuddy_pipeline import get_activities, radius_query
import oldbuddy_pipeline as ob

HERE = os.path.dirname(os.path.abspath(__file__))
WEBAPP = os.path.join(HERE, "webapp")
ACTIVITIES = get_activities(
    sh_app_key=os.environ.get("SH_DATA_APP_KEY"),
    amap_key=os.environ.get("AMAP_KEY"),
)
USER_DEFAULT = {"lat": 31.2304, "lng": 121.4737, "name": "人民广场（演示定位点）"}

CONTENT = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, ctype, body):
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def _serve_file(self, fpath):
        ext = os.path.splitext(fpath)[1]
        ctype = CONTENT.get(ext, "application/octet-stream")
        try:
            with open(fpath, "rb") as f:
                data = f.read()
            self._send(200, ctype, data)
        except Exception:
            self._send(404, "text/plain; charset=utf-8", "not found")

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        q = urllib.parse.parse_qs(parsed.query)

        if path in ("/", "/app"):
            self._serve_file(os.path.join(WEBAPP, "index.html"))
            return

        if path.startswith("/static/"):
            fpath = os.path.normpath(os.path.join(WEBAPP, path[len("/static/"):]))
            if fpath.startswith(WEBAPP) and os.path.isfile(fpath):
                self._serve_file(fpath)
            else:
                self._send(404, "text/plain; charset=utf-8", "not found")
            return

        if path == "/nearby":
            lat = float(q.get("lat", [USER_DEFAULT["lat"]])[0])
            lng = float(q.get("lng", [USER_DEFAULT["lng"]])[0])
            r = float(q.get("radius", [1])[0])
            res = radius_query(ACTIVITIES, lat, lng, r)
            out = json.dumps({"radius": r, "count": len(res), "nearby": res},
                             ensure_ascii=False)
            self._send(200, "application/json; charset=utf-8", out)
            return

        if path == "/refresh":
            res = ob.run_pipeline(
                USER_DEFAULT,
                radius_km=float(q.get("radius", [1])[0]),
                sh_app_key=os.environ.get("SH_DATA_APP_KEY"),
                amap_key=os.environ.get("AMAP_KEY"),
            )
            pv = res["provenance"]
            self._send(200, "application/json; charset=utf-8", json.dumps({
                "ok": True,
                "activities_source": pv["activities_source"],
                "live_count": pv["live_count"],
                "seed_count": pv["seed_count"],
                "geo_source": pv["geo_source"],
                "note": "无 app key / 被 WAF 拦截时自动回退种子数据；填 SH_DATA_APP_KEY 与 AMAP_KEY 即切真实源",
            }, ensure_ascii=False))
            return

        self._send(404, "text/plain; charset=utf-8", "not found")

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    # 绑定 0.0.0.0 以便手机（真机调试/预览）经局域网 IP 访问本服务。
    # 仅本机模拟器用 127.0.0.1 亦可，但真机必须 0.0.0.0。
    srv = ThreadingHTTPServer(("0.0.0.0", 8788), Handler)
    print("old-buddy 小程序原型已启动: http://0.0.0.0:8788 (局域网可访问)")
    srv.serve_forever()
