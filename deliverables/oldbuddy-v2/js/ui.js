/* ui.js — 视图渲染层（附近 / 课程 / 详情 / 我的报名 / 我的 + 弹层） */
(function () {
  window.OB = window.OB || {};
  var store = OB.store;
  var fsel = { radius: 1, cat: "all" };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function greetWord() {
    var h = new Date().getHours();
    if (h < 5) return "夜深了";
    if (h < 11) return "上午好";
    if (h < 13) return "中午好";
    if (h < 18) return "下午好";
    return "晚上好";
  }

  function catLabelOf(key) {
    var c = OB.CATEGORIES.filter(function (x) { return x.key === key; })[0];
    return c ? c.label : "全部";
  }

  function feeTag(a) {
    var free = /免费|0\s*元|免收/.test(a.fee || "");
    return '<span class="fee ' + (free ? "free" : "paid") + '">' + esc(a.fee || (free ? "免费" : "收费")) + "</span>";
  }

  function distOf(a) {
    return a.distance_km != null ? a.distance_km + "km" : "—";
  }

  /* ---------- 卡片 ---------- */

  function cardHTML(a) {
    var fav = store.isFav(a.id);
    return (
      '<div class="card" data-action="open" data-id="' + esc(a.id) + '">' +
        '<div class="top">' +
          '<span class="tag">' + OB.svg("compass", 14) + esc(a.type || "活动") + "</span>" +
          '<button class="fav ' + (fav ? "on" : "") + '" data-action="fav" data-id="' + esc(a.id) + '">' +
            OB.svg("heart", fav ? 20 : 18) + "</button>" +
        "</div>" +
        '<div class="ttl">' + esc(a.title) + "</div>" +
        '<div class="meta">' + OB.svg("clock", 18) + "<span>" + esc(a.time || "时间待定") + "</span></div>" +
        '<div class="meta">' + OB.svg("mapPin", 18) +
          '<span><span class="dist">' + distOf(a) + "</span> · " +
          esc(a.venue || a.address || "地点待定") + "</span></div>" +
        feeTag(a) +
      "</div>"
    );
  }

  function courseCardHTML(a) {
    var booked = store.isBooked(a.id);
    return (
      '<div class="card course" data-action="open" data-id="' + esc(a.id) + '">' +
        '<div class="top">' +
          '<span class="tag">' + OB.svg("bookOpen", 14) + esc(a.type || "课程") + "</span>" +
          '<span class="kind-badge">长期课</span>' +
        "</div>" +
        '<div class="ttl">' + esc(a.title) + "</div>" +
        '<div class="meta">' + OB.svg("clock", 18) + "<span>" + esc(a.schedule || a.time || "时间待定") + "</span></div>" +
        '<div class="meta">' + OB.svg("calendar", 18) +
          "<span>" + esc((a.weeks || "") + (a.start ? " · " + a.start : "")) + "</span></div>" +
        '<div class="meta">' + OB.svg("mapPin", 18) +
          '<span><span class="dist">' + distOf(a) + "</span> · " +
          esc(a.venue || a.address || "地点待定") + "</span></div>" +
        '<div class="cfoot">' +
          '<span class="seats">' + OB.svg("user", 14) + esc(a.seats || "名额待定") + "</span>" +
          '<span class="deadline">' + esc(a.deadline || "") + "</span>" +
        "</div>" +
        feeTag(a) +
        (booked ? '<span class="booked-flag">' + OB.svg("check", 14) + "已报名</span>" : "") +
      "</div>"
    );
  }

  function bkCardHTML(b) {
    var cls = b.status === OB.BK_PENDING ? "pending"
            : b.status === OB.BK_CANCELED ? "canceled" : "done";
    return (
      '<div class="card bk ' + cls + '" data-action="open" data-id="' + esc(b.id) + '">' +
        '<div class="top">' +
          '<span class="bstat ' + cls + '">' + esc(b.status) + "</span>" +
          '<span class="bkind">' + (b.kind === "course" ? "长期课" : "单次活动") + "</span>" +
        "</div>" +
        '<div class="ttl">' + esc(b.title) + "</div>" +
        '<div class="meta">' + OB.svg("clock", 18) + "<span>" + esc(b.schedule || b.time || "时间待定") + "</span></div>" +
        '<div class="meta">' + OB.svg("mapPin", 18) + "<span>" + esc(b.venue || b.address || "地点待定") + "</span></div>" +
        (b.start ? '<div class="meta">' + OB.svg("calendar", 18) + "<span>" + esc(b.start) + "</span></div>" : "") +
        '<div class="bkfoot">' +
          '<span class="btime">报名于 ' + esc(b.bookedAt || "") + " · " + esc(b.fee || "") + "</span>" +
          (b.status === OB.BK_PENDING
            ? '<button class="bbtn" data-action="cancelBooking" data-id="' + esc(b.id) + '">取消报名</button>'
            : "") +
        "</div>" +
      "</div>"
    );
  }

  /* ---------- 顶栏 / Tab ---------- */

  function appbarHome() {
    return (
      '<div class="brand">' + OB.svg("compass", 22) + "老友时光</div>" +
      '<div class="tools">' +
        '<button class="tool" data-action="font" title="大字模式">' + OB.svg("type", 22) + "</button>" +
        '<button class="tool" data-action="refresh" title="刷新">' + OB.svg("refresh", 22) + "</button>" +
      "</div>"
    );
  }

  function appbarSub(title) {
    return (
      '<button class="tool" data-action="back" title="返回">' + OB.svg("chevronLeft", 22) + "</button>" +
      '<div class="sub-title">' + esc(title) + "</div>" +
      '<div style="flex:1"></div>'
    );
  }

  function appbarDetail(a, fav) {
    return (
      '<button class="tool" data-action="back" style="background:rgba(255,255,255,.16);color:#fff;">' + OB.svg("chevronLeft", 24) + "</button>" +
      '<div class="brand" style="color:#fff;font-size:18px;margin-left:6px;">' +
        (a.kind === "course" ? "课程详情" : "活动详情") + "</div>" +
      '<div style="flex:1"></div>' +
      '<button class="tool" data-action="fav" data-id="' + esc(a.id) + '" style="background:rgba(255,255,255,.16);color:' +
        (fav ? "#FFD9C2" : "#fff") + ';">' + OB.svg("heart", 22) + "</button>"
    );
  }

  function tabbar(active) {
    var tabs = [
      { key: "home", label: "附近", icon: "mapPin" },
      { key: "courses", label: "课程", icon: "bookOpen" },
      { key: "me", label: "我的", icon: "user" }
    ];
    return tabs.map(function (t) {
      return (
        '<button class="tab ' + (t.key === active ? "on" : "") + '" data-action="tab" data-tab="' + t.key + '">' +
          OB.svg(t.icon, 24) + '<span class="lab">' + t.label + "</span></button>"
      );
    }).join("");
  }

  function mount(appbar, view, showTab, activeTab) {
    document.getElementById("appbar").innerHTML = appbar;
    document.getElementById("view").innerHTML = view;
    var tb = document.getElementById("tabbar");
    if (showTab) { tb.style.display = "flex"; tb.innerHTML = tabbar(activeTab); }
    else { tb.style.display = "none"; }
    window.scrollTo(0, 0);
  }

  /* ---------- 筛选弹层 ---------- */

  function renderSheet() {
    var root = document.getElementById("dialog-root");
    var radii = OB.RADII.map(function (r) {
      return '<button class="chip ' + (r === fsel.radius ? "on" : "") + '" data-action="pickRadius" data-r="' + r + '">' + r + "km</button>";
    }).join("");
    var cats = OB.CATEGORIES.map(function (c) {
      return '<button class="chip ' + (c.key === fsel.cat ? "on" : "") + '" data-action="pickCat" data-cat="' + c.key + '">' + c.label + "</button>";
    }).join("");
    root.innerHTML =
      '<div class="sheet-overlay" data-action="sheetClose">' +
        '<div class="sheet" data-action="stop">' +
          '<div class="sheet-handle"></div>' +
          '<div class="sheet-title">筛选条件</div>' +
          '<div class="sheet-sec"><div class="ss-label">距离</div><div class="chips">' + radii + "</div></div>" +
          '<div class="sheet-sec"><div class="ss-label">分类</div><div class="chips">' + cats + "</div></div>" +
          '<div class="sheet-acts">' +
            '<button class="sbtn reset" data-action="resetFilter">重置</button>' +
            '<button class="sbtn ok" data-action="applyFilter">查看结果</button>' +
          "</div>" +
        "</div>" +
      "</div>";
  }

  OB.ui = {
    /* ---------- 附近：单次活动，距离优先 ---------- */
    home: function () {
      var all = store.state.data.nearby;
      var cat = store.state.category || "all";
      var feed = (cat === "all") ? all : all.filter(function (a) { return a.type === cat; });
      var catLabel = catLabelOf(cat);
      var cards = feed.length
        ? feed.map(cardHTML).join("")
        : '<div class="empty"><div class="eico">' + OB.svg("search", 30) + "</div>附近 " +
          store.state.radius + "km 内暂无符合条件的活动，换个筛选或稍后再来看看。</div>";
      var sum = store.state.data.stats[store.state.radius] || all.length;
      var view =
        '<div class="hero">' +
          '<div class="greet">' + greetWord() + "，" + esc((store.state.location.name || "附近").slice(0, 4)) + "的老朋友</div>" +
          '<div class="sub">附近单次活动 · 按离您由近到远</div>' +
        "</div>" +
        '<div class="filter-bar">' +
          '<div class="fsum">' +
            '<button class="fpill loc" data-action="locate">' + OB.svg("mapPin", 16) + "<span>" + esc(store.state.location.name) + "</span></button>" +
            '<span class="fpill">' + store.state.radius + 'km</span>' +
            '<span class="fpill">' + catLabel + "</span>" +
            '<span class="fcount">' + sum + " 场</span>" +
          "</div>" +
          '<button class="filter-btn" data-action="filter">' + OB.svg("sliders", 18) + " 筛选</button>" +
        "</div>" +
        '<div class="sec-title"><span class="bar"></span>附近 · 本周活动</div>' +
        '<div class="hint">共 ' + feed.length + " 场，点卡片看详情、收藏或报名</div>" +
        '<div class="feed">' + cards + "</div>" +
        '<div class="src-note">「附近」只收单次活动（讲座 / 演出 / 展览 / 市集 / 便民），随到随参加。<br/>需要报名入学的长期课，请看下方「课程」。</div>';
      mount(appbarHome(), view, true, "home");
    },

    /* ---------- 课程：长期课，全城按兴趣，不受半径限制 ---------- */
    courses: function () {
      var cat = store.state.courseCat || "all";
      var all = store.state.courses;
      var list = (cat === "all") ? all : all.filter(function (a) { return a.type === cat; });
      var chips = OB.CATEGORIES.map(function (c) {
        return '<button class="chip ' + (c.key === cat ? "on" : "") + '" data-action="courseCat" data-cat="' + c.key + '">' + c.label + "</button>";
      }).join("");
      var cards = list.length
        ? list.map(courseCardHTML).join("")
        : '<div class="empty"><div class="eico">' + OB.svg("search", 30) + "</div>该分类下暂无长期课。</div>";
      var view =
        '<div class="courses-hero">' +
          '<div class="ch-title">' + OB.svg("bookOpen", 22) + "长期课 · 全城选课</div>" +
          '<div class="ch-sub">需要报名入学、有固定课时与开班时间的课程。<br/>不受距离限制，按离您由近到远排列。</div>' +
        "</div>" +
        '<div class="chips" style="padding: 12px 14px 2px;">' + chips + "</div>" +
        '<div class="sec-title"><span class="bar"></span>' + esc(catLabelOf(cat)) + "课程 · 共 " + list.length + " 门</div>" +
        '<div class="hint">点卡片看课时安排、名额与报名</div>' +
        '<div class="feed">' + cards + "</div>" +
        '<div class="src-note">课程由 AI 自动聚合老年大学 / 文化馆 / 社区学校公开课程（演示数据）</div>';
      mount(appbarHome(), view, true, "courses");
    },

    /* ---------- 我的报名（订单） ---------- */
    bookings: function () {
      var all = store.getBookings();
      var tab = store.state.bkTab || "pending";
      var pending = all.filter(function (b) { return b.status === OB.BK_PENDING; });
      var list = (tab === "pending") ? pending : all;
      var segs = [
        { k: "pending", label: "待参加 " + pending.length },
        { k: "all", label: "全部 " + all.length }
      ].map(function (s) {
        return '<button class="rseg bk ' + (s.k === tab ? "on" : "") + '" data-action="bkTab" data-tab="' + s.k + '">' + s.label + "</button>";
      }).join("");
      var cards = list.length
        ? list.map(bkCardHTML).join("")
        : '<div class="empty"><div class="eico">' + OB.svg("calendar", 30) + "</div>" +
          (tab === "pending" ? "还没有待参加的活动，去「附近」或「课程」看看。" : "还没有报名记录。") + "</div>";
      var view =
        '<div class="sec-title"><span class="bar"></span>我的报名</div>' +
        '<div class="hint">共 ' + all.length + " 条记录，" + pending.length + " 条待参加</div>" +
        '<div class="bk-seg">' + segs + "</div>" +
        '<div class="feed">' + cards + "</div>" +
        '<div class="anti" style="margin: 8px 14px 14px;">' + OB.svg("shield", 22) +
          '<div class="at"><b>防骗提醒：</b>任何要求您转账、提供短信验证码或付费“代抢名额”的，都是诈骗。报名只走官方渠道。</div></div>';
      mount(appbarSub("我的报名"), view, false);
    },

    /* ---------- 详情 ---------- */
    detail: function (id) {
      var a = store.getById(id);
      if (!a) { OB.router.go("/"); return; }
      var fav = store.isFav(a.id);
      var booked = store.isBooked(a.id);
      var isCourse = a.kind === "course";
      var iconName = a.type === "运动" ? "activity" : a.type === "公益" ? "heartPulse" : "music";
      var rows =
        '<div class="row"><span class="ric">' + OB.svg("clock", 20) + '</span><div class="rc"><div class="rk">' +
          (isCourse ? "上课时间" : "活动时间") + '</div><div class="rv">' + esc(a.schedule || a.time || "待定") + "</div></div></div>" +
        (isCourse ? '<div class="row"><span class="ric">' + OB.svg("calendar", 20) + '</span><div class="rc"><div class="rk">课时 · 开班</div><div class="rv">' +
          esc((a.weeks || "待定") + " · " + (a.start || "待定")) + "</div></div></div>" : "") +
        (isCourse ? '<div class="row"><span class="ric">' + OB.svg("user", 20) + '</span><div class="rc"><div class="rk">名额 · 报名截止</div><div class="rv">' +
          esc((a.seats || "待定") + " · " + (a.deadline || "待定")) + "</div></div></div>" : "") +
        '<div class="row"><span class="ric">' + OB.svg("mapPin", 20) + '</span><div class="rc"><div class="rk">地点</div><div class="rv">' +
          esc(a.address || a.venue || "待定") + "</div></div></div>" +
        '<div class="row"><span class="ric">' + OB.svg("compass", 20) + '</span><div class="rc"><div class="rk">费用</div><div class="rv">' +
          esc(a.fee || "待定") + "</div></div></div>" +
        '<div class="row"><span class="ric">' + OB.svg("info", 20) + '</span><div class="rc"><div class="rk">' +
          (isCourse ? "报名方式" : "参加方式") + '</div><div class="rv">' + esc(a.signup || "现场参加") + "</div></div></div>";
      var view =
        '<div class="detail-hero">' +
          '<span class="dtype">' + OB.svg(isCourse ? "bookOpen" : "compass", 14) +
            esc((a.type || "活动") + (isCourse ? " · 长期课" : "")) + "</span>" +
          '<div class="dtitle">' + esc(a.title) + "</div>" +
          '<div class="ddist">距您 ' + distOf(a) + " · " + esc(a.venue || "") + "</div>" +
          '<div class="dico">' + OB.svg(iconName, 38) + "</div>" +
        "</div>" +
        '<div class="panel">' + rows + "</div>" +
        '<div class="desc"><h3>' + (isCourse ? "课程介绍" : "活动介绍") + "</h3><p>" +
          esc(a.desc || (isCourse
            ? "本课程由社区学校 / 老年大学组织，按周期授课，欢迎附近居民报名入学。具体课时与安排以开班通知为准。"
            : "本场活动由社区组织，欢迎附近居民参与。具体内容与安排以现场为准。")) + "</p></div>" +
        '<div class="anti">' + OB.svg("shield", 22) +
          '<div class="at"><b>防骗提醒：</b>报名与缴费请仅通过官方渠道。凡是要求您转账、提供短信验证码或付费“代抢名额”的，均为诈骗。</div></div>' +
        '<div class="actions">' +
          '<button class="btn ghost" data-action="nav" data-id="' + esc(a.id) + '">' + OB.svg("navigation", 20) + "一键导航</button>" +
          (booked
            ? '<button class="btn solid" data-action="bookings">' + OB.svg("check", 20) + "已报名 · 看行程</button>"
            : '<button class="btn solid" data-action="signup" data-id="' + esc(a.id) + '">' +
              OB.svg("check", 20) + (isCourse ? "我要报名" : "我要参加") + "</button>") +
        "</div>";
      mount(appbarDetail(a, fav), view, false);
    },

    /* ---------- 我的 ---------- */
    me: function () {
      var s = store.state.settings;
      var favs = store.getFavs();
      var pend = store.pendingCount();
      var view =
        '<div class="profile"><div class="avatar">' + OB.svg("user", 30) + "</div>" +
          '<div><div class="pn">老朋友</div><div class="ps">用心过好每一天</div></div></div>' +
        '<div class="list">' +
          '<div class="item" data-action="bookings"><span class="ii">' + OB.svg("calendar", 18) +
            '</span><div class="it">我的报名</div><div class="iv">' +
            (pend ? '<span class="badge">' + pend + "</span> 待参加" : "暂无") + ' ›</div></div>' +
          (favs.length
            ? '<div class="item" data-action="favlist"><span class="ii">' + OB.svg("bookmark", 18) +
              '</span><div class="it">我的收藏</div><div class="iv">' + favs.length + " 个 ›</div></div>"
            : "") +
        "</div>" +
        '<div class="list">' +
          '<div class="item" data-action="toggleFont"><span class="ii">' + OB.svg("type", 18) + '</span><div class="it">大字模式</div><div class="switch ' + (s.bigFont ? "on" : "") + '"></div></div>' +
          '<div class="item" data-action="toggleVoice"><span class="ii">' + OB.svg("volume2", 18) + '</span><div class="it">语音播报</div><div class="switch ' + (s.voice ? "on" : "") + '"></div></div>' +
          '<div class="item" data-action="locate"><span class="ii">' + OB.svg("mapPin", 18) + '</span><div class="it">定位设置</div><div class="iv">' + esc(store.state.location.name) + "</div></div>" +
        "</div>" +
        '<div class="list">' +
          '<div class="item" data-action="anti"><span class="ii">' + OB.svg("shield", 18) + '</span><div class="it">防骗须知</div><div class="iv">›</div></div>' +
          '<div class="item" data-action="about"><span class="ii">' + OB.svg("info", 18) + '</span><div class="it">关于老友时光</div><div class="iv">›</div></div>' +
        "</div>";
      mount(appbarHome(), view, true, "me");
    },

    /* ---------- 弹层 ---------- */
    dialog: function (opt) {
      var root = document.getElementById("dialog-root");
      root.innerHTML =
        '<div class="overlay">' +
          '<div class="dialog">' +
            (opt.icon ? '<div class="dh">' + OB.svg(opt.icon, 22) + esc(opt.title || "") + "</div>" : '<div class="dh">' + esc(opt.title || "") + "</div>") +
            '<div class="db">' + opt.body + (opt.url ? '<div class="durl">' + esc(opt.url) + "</div>" : "") + "</div>" +
            '<div class="dacts">' +
              (opt.cancel !== false ? '<button class="dbtn cancel" data-d="cancel">取消</button>' : "") +
              '<button class="dbtn ' + (opt.okClass || "ok") + '" data-d="ok">' + esc(opt.okText || "好的") + "</button>" +
            "</div>" +
          "</div></div>";
      root._onOk = opt.onOk || null;
    },
    closeDialog: function () { document.getElementById("dialog-root").innerHTML = ""; },

    openFilter: function () {
      fsel.radius = store.state.radius;
      fsel.cat = store.state.category || "all";
      renderSheet();
    },
    pickRadius: function (r) { fsel.radius = parseFloat(r); renderSheet(); },
    pickCat: function (c) { fsel.cat = c; renderSheet(); },
    resetFilter: function () { fsel.radius = 1; fsel.cat = "all"; renderSheet(); },
    closeFilterModal: function () { document.getElementById("dialog-root").innerHTML = ""; },
    getFilter: function () { return fsel; }
  };
})();
