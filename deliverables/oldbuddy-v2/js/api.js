/* api.js — 数据访问层（封装后端 /nearby，BASE 用相对路径，本地与局域网通用） */
(function () {
  window.OB = window.OB || {};

  OB.api = {
    nearby: function (lat, lng, radius, name) {
      var u = "/nearby?lat=" + lat + "&lng=" + lng + "&radius=" + radius +
        "&name=" + encodeURIComponent(name || "");
      return fetch(u, { cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          // 归一化：确保字段齐全
          (d.nearby || []).forEach(function (a) {
            a.fav = false;
            if (a.distance_km != null) a.distance_km = Math.round(a.distance_km * 10) / 10;
          });
          return d;
        });
    },
    courses: function (lat, lng, name) {
      var u = "/courses?lat=" + lat + "&lng=" + lng + "&name=" + encodeURIComponent(name || "");
      return fetch(u, { cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          (d.courses || []).forEach(function (a) {
            a.fav = false;
            if (a.distance_km != null) a.distance_km = Math.round(a.distance_km * 10) / 10;
          });
          return d;
        });
    },
    refresh: function () {
      return fetch("/refresh", { cache: "no-store" }).then(function (r) { return r.json(); });
    }
  };
})();
