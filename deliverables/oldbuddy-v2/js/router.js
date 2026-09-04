/* router.js — 哈希路由：附近 / 课程 / 详情 / 我的报名 / 我的 */
(function () {
  window.OB = window.OB || {};

  function parse() {
    var h = location.hash.replace(/^#\/?/, "");
    var parts = h.split("/");
    if (parts[0] === "detail" && parts[1]) return { name: "detail", id: decodeURIComponent(parts[1]) };
    if (parts[0] === "courses") return { name: "courses" };
    if (parts[0] === "bookings") return { name: "bookings" };
    if (parts[0] === "me") return { name: "me" };
    return { name: "home" };
  }

  OB.router = {
    go: function (path) { location.hash = path; },
    route: function () {
      var r = parse();
      if (r.name === "detail") OB.ui.detail(r.id);
      else if (r.name === "courses") OB.ui.courses();
      else if (r.name === "bookings") OB.ui.bookings();
      else if (r.name === "me") OB.ui.me();
      else OB.ui.home();
    },
    bind: function () { window.addEventListener("hashchange", OB.router.route); }
  };
})();
