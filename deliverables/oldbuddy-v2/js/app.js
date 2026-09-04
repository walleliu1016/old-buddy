/* app.js — 应用入口：数据加载 + 全局事件委托 + 交互编排 */
(function () {
  window.OB = window.OB || {};
  var store = OB.store;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function applyBigFont() {
    document.body.classList.toggle("big", !!store.state.settings.bigFont);
  }

  function toast(msg) {
    var t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(31,42,43,.92);color:#fff;padding:12px 18px;border-radius:12px;font-size:16px;z-index:99;max-width:280px;text-align:center;";
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 1600);
  }

  function reloadAndRender() {
    var loc = store.state.location, r = store.state.radius;
    return Promise.all([
      OB.api.nearby(loc.lat, loc.lng, r, loc.name)
        .then(function (d) { store.setData(d); })
        .catch(function () { store.setData({ nearby: [], stats: {} }); }),
      OB.api.courses(loc.lat, loc.lng, loc.name)
        .then(function (d) { store.setCourses(d.courses || []); })
        .catch(function () { store.setCourses([]); })
    ]).then(function () { OB.router.route(); });
  }

  function handleAction(el) {
    var act = el.dataset.action;
    var id = el.dataset.id;

    if (act === "open") { OB.router.go("detail/" + encodeURIComponent(id)); return; }
    if (act === "back") { history.back(); return; }

    if (act === "tab") {
      var t = el.dataset.tab;
      OB.router.go(t === "home" ? "/" : t);
      return;
    }
    if (act === "bookings") { OB.router.go("bookings"); return; }

    if (act === "radius") {
      store.setRadius(parseFloat(el.dataset.r));
      reloadAndRender();
      return;
    }
    if (act === "courseCat") {
      store.setCourseCat(el.dataset.cat);
      OB.router.route();
      return;
    }
    if (act === "bkTab") {
      store.state.bkTab = el.dataset.tab;
      OB.router.route();
      return;
    }

    if (act === "fav") {
      var item = store.getById(id);
      if (!item) return;
      store.toggleFav({
        id: item.id, title: item.title, type: item.type, venue: item.venue,
        address: item.address, time: item.time, lat: item.lat, lng: item.lng, fee: item.fee
      });
      OB.router.route();
      return;
    }

    if (act === "font" || act === "toggleFont") {
      var nf = !store.state.settings.bigFont;
      store.setSetting("bigFont", nf);
      applyBigFont();
      OB.router.route();
      toast(nf ? "已开启大字模式" : "已关闭大字模式");
      return;
    }

    if (act === "toggleVoice") {
      var nv = !store.state.settings.voice;
      store.setSetting("voice", nv);
      OB.router.route();
      toast(nv ? "已开启语音播报" : "已关闭语音播报");
      return;
    }

    if (act === "refresh") {
      reloadAndRender().then(function () { toast("已刷新附近活动"); });
      return;
    }

    if (act === "locate") {
      if (!navigator.geolocation) { toast("当前环境不支持定位"); return; }
      toast("正在获取定位…");
      navigator.geolocation.getCurrentPosition(function (pos) {
        store.setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, name: "我的位置" });
        reloadAndRender();
      }, function () { toast("定位未授权，使用默认位置"); });
      return;
    }

    if (act === "nav") {
      var a = store.getById(id);
      if (a && a.lat && a.lng) {
        window.open("https://uri.amap.com/marker?position=" + a.lng + "," + a.lat + "&name=" + encodeURIComponent(a.title || "活动地点"), "_blank");
      } else { toast("暂无坐标信息"); }
      return;
    }

    /* ---- 报名 / 参加：写本地报名（订单） ---- */
    if (act === "signup") {
      var b = store.getById(id);
      if (!b) return;
      var isCourse = b.kind === "course";
      var when = isCourse
        ? "课时：" + esc(b.weeks || "待定") + " · " + esc(b.start || "")
        : "时间：" + esc(b.time || "待定");
      OB.ui.dialog({
        icon: "shield",
        title: isCourse ? "报名确认" : "参加确认",
        body: "您即将报名：<b>" + esc(b.title) + "</b><br/>" +
              esc(when) + "<br/>费用：" + esc(b.fee || "待定") + "<br/><br/>" +
              "报名与缴费请<b>仅通过官方渠道</b>" +
              (b.signup ? "（" + esc(b.signup) + "）" : "") +
              "。凡要求转账、提供短信验证码或付费“代抢名额”的，均为诈骗。",
        okText: isCourse ? "确认报名" : "确认参加",
        okClass: "primary",
        onOk: function () {
          store.addBooking(b);
          OB.ui.closeDialog();
          toast(isCourse ? "已记入我的报名" : "已记入我的行程");
          OB.router.go("bookings");
        }
      });
      return;
    }

    if (act === "cancelBooking") {
      OB.ui.dialog({
        icon: "info",
        title: "取消报名",
        body: "确定要取消这一条报名记录吗？取消后名额将释放给其他人。",
        okText: "确认取消",
        okClass: "primary",
        onOk: function () {
          store.cancelBooking(id);
          OB.ui.closeDialog();
          OB.router.route();
          toast("已取消报名");
        }
      });
      return;
    }

    if (act === "anti") {
      OB.ui.dialog({
        icon: "shield", title: "防骗须知",
        body: "1. 报名与缴费只走官方渠道。<br/>2. 不向任何人透露短信验证码。<br/>3. 凡“代缴、代抢、内部名额”要钱的，都是诈骗。<br/>4. 遇可疑情况可拨打 96110。",
        okText: "我记住了"
      });
      return;
    }

    if (act === "about") {
      OB.ui.dialog({
        icon: "info", title: "关于老友时光",
        body: "老友时光，帮 50-60 岁的您，按定位发现家门口的社区活动、课程与公益服务。<br/><br/>" +
              "「附近」= 单次活动，按距离发现；<br/>「课程」= 长期课，全城按兴趣选课。",
        okText: "知道了"
      });
      return;
    }

    if (act === "favlist") {
      OB.router.go("me");
      return;
    }

    /* ---- 筛选弹层 ---- */
    if (act === "filter") { OB.ui.openFilter(); return; }
    if (act === "pickRadius") { OB.ui.pickRadius(el.dataset.r); return; }
    if (act === "pickCat") { OB.ui.pickCat(el.dataset.cat); return; }
    if (act === "resetFilter") { OB.ui.resetFilter(); return; }
    if (act === "applyFilter") {
      var f = OB.ui.getFilter();
      store.setRadius(f.radius);
      store.state.category = f.cat;
      OB.ui.closeFilterModal();
      reloadAndRender();
      return;
    }
    if (act === "sheetClose") { OB.ui.closeFilterModal(); return; }
    if (act === "stop") { return; }
  }

  function handleDialog(el) {
    var d = el.dataset.d;
    if (d === "cancel") { OB.ui.closeDialog(); return; }
    if (d === "ok") {
      var root = document.getElementById("dialog-root");
      if (root._onOk) root._onOk();
      else OB.ui.closeDialog();
    }
  }

  function bind() {
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (t) { handleAction(t); return; }
      var d = e.target.closest("[data-d]");
      if (d) { handleDialog(d); }
    });
  }

  function init() {
    applyBigFont();
    bind();
    OB.router.bind();
    reloadAndRender();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
