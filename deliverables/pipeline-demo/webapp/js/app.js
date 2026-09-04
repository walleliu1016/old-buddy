/* ============================================================
   老友时光 · 小程序前端原型（移动端 Web SPA，1:1 映射微信原生）
   - 定位作为贯穿全产品的筛选主轴（首页/分类/详情/收藏均受半径约束）
   - 适老化：大字模式、语音播报、大点击区、防诈骗确认
   - 零第三方依赖，图标全部内联 SVG（Lucide 同源，无 emoji）
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- 内联 SVG 图标（Lucide 同源线性图标） ---------------- */
  var ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    user: '<circle cx="12" cy="8" r="3.4"/><path d="M5 21a7 7 0 0 1 14 0"/>',
    mapPin: '<path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    phone: '<path d="M5 4h3l2 5-2 1a11 11 0 0 0 5 5l1-2 5 2v3c0 1-1 2-2 2C10 21 3 14 3 6c0-1 1-2 2-2z"/>',
    navigation: '<path d="M3 11l18-8-8 18-2-8-8-2z"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v4h-4"/>',
    volume: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 8a5 5 0 0 1 0 8"/>',
    type: '<path d="M4 6h16M12 6v14"/>',
    chevronRight: '<path d="M9 6l6 6-6 6"/>',
    chevronLeft: '<path d="M15 6l-6 6 6 6"/>',
    heart: '<path d="M12 21l-7-7a4.6 4.6 0 0 1 7-6 4.6 4.6 0 0 1 7 6z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9h16M8 3v4M16 3v4"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
    book: '<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 0-2 2z"/><path d="M5 4v16"/>',
    image: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 11l3-3 4 4 3-3 2 2"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="16" cy="9" r="2.6"/><path d="M15 20a6 6 0 0 1 6-6"/>',
    bag: '<path d="M6 8h12l-1 11H7z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    pulse: '<path d="M3 12h4l2 6 4-14 2 8h6"/>',
    share: '<circle cx="18" cy="8" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="16" r="2"/><path d="M8 11l8-3M8 13l8 3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    check: '<path d="M5 13l4 4L19 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  function svg(name, size, opts) {
    opts = opts || {};
    var inner = ICONS[name] || "";
    var fill = opts.fill ? "currentColor" : "none";
    var sw = opts.strokeWidth || 2;
    return '<svg viewBox="0 0 24 24" width="' + (size || 24) + '" height="' + (size || 24) +
      '" fill="' + fill + '" stroke="currentColor" stroke-width="' + sw +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }

  /* ---------------- 分类定义（关键词匹配，覆盖后端中文 type/title） ---------------- */
  var CATEGORIES = [
    { key: "shufa",    label: "书画",   icon: "book",    kw: ["书画", "书法", "画"] },
    { key: "shengyue", label: "声乐戏曲", icon: "music",   kw: ["合唱", "声乐", "歌", "钢琴", "戏曲", "评弹", "沪剧", "音乐", "歌剧"] },
    { key: "yangsheng",label: "太极养生", icon: "pulse",   kw: ["太极", "养生", "晨练", "跑步", "广场舞", "运动", "晨跑"] },
    { key: "dushu",    label: "读书讲座", icon: "book",    kw: ["读书", "讲座", "书会", "读书角", "讲堂", "读书会"] },
    { key: "jiankang", label: "义诊健康", icon: "heart",   kw: ["义诊", "健康"] },
    { key: "shougong", label: "手工市集", icon: "bag",     kw: ["手工", "市集", "便民", "服务"] },
    { key: "wenhua",   label: "展览文化", icon: "image",   kw: ["展览", "导赏", "故事会", "寻访", "文化", "艺术", "博物馆", "纪念馆"] },
    { key: "gongyi",   label: "公益志愿", icon: "users",   kw: ["公益", "志愿"] }
  ];
  function matchCategory(a) {
    var hay = (a.type || "") + " " + (a.title || "") + " " + (a.venue || "");
    for (var i = 0; i < CATEGORIES.length; i++) {
      for (var j = 0; j < CATEGORIES[i].kw.length; j++) {
        if (hay.indexOf(CATEGORIES[i].kw[j]) >= 0) return CATEGORIES[i].key;
      }
    }
    return "other";
  }
  function catLabel(key) {
    if (key === "other") return "其他";
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].key === key) return CATEGORIES[i].label;
    return "其他";
  }

  /* ---------------- 全局状态 ---------------- */
  var state = {
    location: { lat: 31.2304, lng: 121.4737, name: "人民广场（演示定位点）", authorized: false },
    radius: 1,
    favorites: [],
    settings: { largeFont: false, voice: false },
    selectedCategory: null,
    data: { byRadius: {}, stats: {} },
    index: {}
  };
  var RADII = [1, 3, 5, 10];

  function persist() {
    try {
      localStorage.setItem("ob_radius", JSON.stringify(state.radius));
      localStorage.setItem("ob_favorites", JSON.stringify(state.favorites));
      localStorage.setItem("ob_settings", JSON.stringify(state.settings));
      localStorage.setItem("ob_location", JSON.stringify(state.location));
    } catch (e) {}
  }
  function loadPersisted() {
    try {
      var r = JSON.parse(localStorage.getItem("ob_radius")); if (RADII.indexOf(r) >= 0) state.radius = r;
      state.favorites = JSON.parse(localStorage.getItem("ob_favorites")) || [];
      state.settings = JSON.parse(localStorage.getItem("ob_settings")) || { largeFont: false, voice: false };
      var l = JSON.parse(localStorage.getItem("ob_location")); if (l) state.location = l;
    } catch (e) {}
  }

  /* ---------------- 接口 ---------------- */
  function apiNearby(lat, lng, radius) {
    return fetch("/nearby?lat=" + lat + "&lng=" + lng + "&radius=" + radius).then(function (r) { return r.json(); });
  }
  function buildIndex() {
    state.index = {};
    RADII.forEach(function (r) {
      (state.data.byRadius[r] || []).forEach(function (a) { state.index[a.id] = a; });
    });
    state.favorites.forEach(function (a) { state.index[a.id] = a; });
  }
  function isFav(id) { return state.favorites.some(function (f) { return f.id === id; }); }
  function toggleFav(a) {
    if (isFav(a.id)) state.favorites = state.favorites.filter(function (f) { return f.id !== a.id; });
    else state.favorites.unshift(a);
    persist();
  }

  /* ---------------- 工具 ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function curFeed() { return state.data.byRadius[state.radius] || []; }
  function descOf(a) {
    var s = "【" + (a.title || "") + "】将于 " + (a.time || "待定") + " 在 " + (a.venue || "") +
      "（" + (a.address || "") + "）举办。";
    if (a.fee === "免费") s += "本活动免费参与。"; else s += "活动费用：" + (a.fee || "待定") + "。";
    s += "报名方式：" + (a.signup || "现场报名") + "。信息来源：" + (a.source || "公开聚合") + "。";
    return s;
  }
  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = "zh-CN"; u.rate = 0.95; u.pitch = 1;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ---------------- 顶栏 / Tab ---------------- */
  function greetWord() {
    var h = new Date().getHours();
    if (h < 11) return "上午好";
    if (h < 14) return "中午好";
    if (h < 18) return "下午好";
    return "晚上好";
  }
  function renderTopHome() {
    return '<div class="t1"><div class="brand">' + svg("mapPin", 22) + '老友时光</div>' +
      '<div class="tools"><button class="tool" data-action="toggleFont" title="大字模式">' + svg("type", 22) +
      '</button><button class="tool" data-action="refresh" title="刷新">' + svg("refresh", 22) + '</button></div></div>';
  }
  var TABS = [
    { key: "home", label: "附近", icon: "home" },
    { key: "category", label: "分类", icon: "grid" },
    { key: "favorites", label: "收藏", icon: "bookmark" },
    { key: "me", label: "我的", icon: "user" }
  ];
  function renderTabbar(active) {
    return TABS.map(function (t) {
      return '<button class="tab' + (t.key === active ? " on" : "") + '" data-action="tab" data-tab="' + t.key + '">' +
        svg(t.icon, 26) + '<span>' + t.label + '</span></button>';
    }).join("");
  }

  /* ---------------- 页面：首页 ---------------- */
  function renderHome() {
    var feed = curFeed();
    var rsegs = RADII.map(function (r) {
      var cnt = state.data.stats[r];
      var c = (cnt == null) ? "…" : cnt;
      return '<button class="rseg' + (r === state.radius ? " on" : "") + '" data-action="setRadius" data-r="' + r + '">' +
        r + 'km<span class="rcnt">' + c + ' 场</span></button>';
    }).join("");
    var cats = CATEGORIES.map(function (c) {
      return '<button class="cat-cell" data-action="goCategory" data-cat="' + c.key + '">' +
        '<span class="cico">' + svg(c.icon, 24) + '</span><span class="cl">' + c.label + '</span></button>';
    }).join("");
    var cards = feed.length ? feed.map(cardHTML).join("") : emptyNearby();

    return '<header class="topbar">' + renderTopHome() + '</header>' +
      '<div class="view">' +
      '<div class="hero">' +
        '<div class="greet">' + greetWord() + '，为您发现附近的活动</div>' +
        '<div class="hloc" data-action="locate">' + svg("mapPin", 18) + '<span>' + esc(state.location.name) + '</span></div>' +
        '<div class="radius-seg">' + rsegs + '</div>' +
        '<div class="hsum">当前 <b>' + state.radius + 'km</b> 内有 <b>' + feed.length + '</b> 场本周活动</div>' +
      '</div>' +
      '<div class="sec-title">按分类快速找</div>' +
      '<div class="cat-grid">' + cats + '</div>' +
      '<div class="sec-title">附近 ' + state.radius + 'km · 本周活动</div>' +
      '<div class="hint">共 ' + feed.length + ' 场，按离您的距离由近到远排列</div>' +
      cards +
      '<div class="src-note">活动由 AI 自动聚合上海公共文化资源（演示数据）<br/>真实环境接入上海公共开放数据 + 高德地理编码</div>' +
      '</div>' +
      '<nav class="tabbar">' + renderTabbar("home") + '</nav>';
  }

  function cardHTML(a) {
    var fav = isFav(a.id);
    return '<div class="card" data-action="open" data-id="' + a.id + '">' +
      '<span class="badge">' + esc(a.type || "活动") + '</span>' +
      '<button class="fav' + (fav ? " on" : "") + '" data-action="fav" data-id="' + a.id + '">' +
      svg("heart", 20, { fill: fav }) + '</button>' +
      '<div class="ct">' + esc(a.title) + '</div>' +
      '<div class="meta">' + svg("clock", 18) + '<span>' + esc(a.time) + '</span></div>' +
      '<div class="meta">' + svg("mapPin", 18) + '<span>' + esc(a.venue) + ' · ' + (a.distance_km) + 'km</span></div>' +
      '<div class="meta">' + (a.fee === "免费"
        ? '<span class="free">' + svg("check", 16) + ' 免费</span>'
        : '<span>费用：' + esc(a.fee) + '</span>') + '</div>' +
      '</div>';
  }
  function emptyNearby() {
    var sugg = "";
    for (var i = 0; i < RADII.length; i++) {
      if (RADII[i] > state.radius && state.data.stats[RADII[i]] > 0) {
        sugg = '<button class="btn btn-ghost" data-action="setRadius" data-r="' + RADII[i] + '">' +
          '放大到 ' + RADII[i] + 'km（有 ' + state.data.stats[RADII[i]] + ' 场）</button>';
        break;
      }
    }
    return '<div class="empty"><div class="et">' + state.radius + 'km 内暂时没有活动</div>' +
      '<div class="es">换个更大的范围看看？</div>' + sugg + '</div>';
  }

  /* ---------------- 页面：分类 ---------------- */
  function renderCategory() {
    var sel = state.selectedCategory;
    var chips = '<button class="chip' + (!sel ? " on" : "") + '" data-action="pickCat" data-cat="">全部</button>' +
      CATEGORIES.map(function (c) {
        var n = countInCat(c.key);
        return '<button class="chip' + (sel === c.key ? " on" : "") + '" data-action="pickCat" data-cat="' + c.key + '">' +
          svg(c.icon, 18) + c.label + ' ' + n + '</button>';
      }).join("");

    var list;
    if (sel) {
      var items = curFeed().filter(function (a) { return matchCategory(a) === sel; });
      list = items.length ? items.map(cardHTML).join("") :
        '<div class="empty"><div class="et">' + catLabel(sel) + '暂无活动</div>' +
        '<div class="es">放大范围或切换分类试试</div></div>';
    } else {
      var f = curFeed();
      list = f.length ? f.map(cardHTML).join("") : emptyNearby();
    }

    return '<header class="topbar"><div class="t1">' +
      '<div class="brand">' + svg("grid", 22) + '分类浏览</div></div></header>' +
      '<div class="view">' +
      '<div class="hint" style="margin-top:12px;">当前 ' + state.radius + 'km 范围内 · 仅显示附近活动</div>' +
      '<div class="chips">' + chips + '</div>' + list +
      '</div>' +
      '<nav class="tabbar">' + renderTabbar("category") + '</nav>';
  }
  function countInCat(key) {
    return curFeed().filter(function (a) { return matchCategory(a) === key; }).length;
  }

  /* ---------------- 页面：收藏 ---------------- */
  function renderFavorites() {
    var list = state.favorites.length
      ? state.favorites.map(cardHTML).join("")
      : '<div class="empty"><div class="et">还没有收藏</div>' +
        '<div class="es">在活动卡片上点心形，就能收藏在这里</div>' +
        '<button class="btn btn-primary" data-action="tab" data-tab="home">去附近看看</button></div>';
    return '<header class="topbar"><div class="t1">' +
      '<div class="brand">' + svg("bookmark", 22) + '我的收藏</div></div></header>' +
      '<div class="view"><div class="sec-title">已收藏 ' + state.favorites.length + ' 个活动</div>' + list + '</div>' +
      '<nav class="tabbar">' + renderTabbar("favorites") + '</nav>';
  }

  /* ---------------- 页面：我的 ---------------- */
  function renderMe() {
    var s = state.settings;
    var rows =
      menuRow("bookmark", "我的收藏", state.favorites.length + " 个", "tab", "favorites") +
      menuRow("type", "大字模式", "", "toggle", "largeFont", s.largeFont) +
      menuRow("volume", "语音播报", "", "toggle", "voice", s.voice) +
      menuRow("mapPin", "定位授权", state.location.authorized ? "已授权" : "未授权", "locate") +
      menuRow("shield", "防骗须知", "", "antiFraud") +
      menuRow("info", "关于老友时光", "", "about");
    return '<header class="topbar"><div class="t1">' +
      '<div class="brand">' + svg("user", 22) + '我的</div></div></header>' +
      '<div class="view">' +
      '<div class="account"><div class="ava">' + svg("user", 30) + '</div>' +
      '<div><div class="an">老友时光</div><div class="as">帮您发现家门口的活动</div></div></div>' +
      '<div class="menu">' + rows + '</div>' +
      '<div class="src-note">老友时光 · 适老版 Demo<br/>定位发现 · AI 聚合 · 防诈骗提示</div>' +
      '</div>' +
      '<nav class="tabbar">' + renderTabbar("me") + '</nav>';
  }
  function menuRow(icon, label, right, action, key, on) {
    var mr = "";
    if (action === "toggle") {
      mr = '<button class="switch' + (on ? " on" : "") + '" data-action="toggle" data-key="' + key + '"></button>';
    } else if (right) {
      mr = '<span>' + esc(right) + '</span>' + (action ? svg("chevronRight", 18) : "");
    } else if (action) {
      mr = svg("chevronRight", 18);
    }
    return '<div class="row" data-action="' + (action || "") + '"' + (key ? ' data-key="' + key + '"' : '') + '>' +
      '<span class="mi">' + svg(icon, 22) + '</span><span class="ml">' + label + '</span>' +
      '<span class="mr">' + mr + '</span></div>';
  }

  /* ---------------- 页面：详情 ---------------- */
  function renderDetail(id) {
    var a = state.index[id];
    if (!a) return '<div class="empty"><div class="et">活动已失效</div>' +
      '<button class="btn btn-primary" data-action="tab" data-tab="home">返回附近</button></div>';
    var fav = isFav(a.id);
    var html =
      '<header class="topbar"><div class="t1" style="padding:10px 8px 10px 12px;display:flex;align-items:center;gap:6px;">' +
      '<button class="tool" data-action="back" style="background:rgba(255,255,255,.16);">' + svg("chevronLeft", 24) + '</button>' +
      '<div class="brand" style="font-size:18px;">活动详情</div></div></header>' +
      '<div class="view">' +
      '<div class="detail-head">' +
      '<span class="badge">' + esc(a.type || "活动") + '</span>' +
      '<h2>' + esc(a.title) + '</h2>' +
      '<div class="info-row">' + svg("clock", 20) + '<span class="v">' + esc(a.time) + '</span></div>' +
      '<div class="info-row">' + svg("mapPin", 20) + '<span class="v">' + esc(a.venue) + '<br/>' + esc(a.address) + '（距您 ' + a.distance_km + 'km）</span></div>' +
      '<div class="info-row">' + svg("user", 20) + '<span class="v">费用：' + (a.fee === "免费" ? '<span class="free">免费</span>' : esc(a.fee)) + '</span></div>' +
      '<div class="prov">数据来源：' + esc(a.source || "公开聚合") + (a.geo_source ? ' · 坐标：' + esc(a.geo_source) : '') + '</div>' +
      '</div>' +
      '<div class="desc">' + esc(descOf(a)) + '</div>' +
      '<button class="btn btn-ghost" data-action="nav" data-id="' + a.id + '">' + svg("navigation", 20) + '一键导航</button>' +
      '<div class="btn-row">' +
      '<button class="btn btn-primary" data-action="signup" data-id="' + a.id + '">' + svg("check", 20) + '我要报名</button>' +
      '<button class="btn btn-ghost" style="max-width:120px;" data-action="fav" data-id="' + a.id + '">' + svg("heart", 20, { fill: fav }) + (fav ? '已收藏' : '收藏') + '</button>' +
      '</div>' +
      '<button class="btn btn-ghost" data-action="speak" data-id="' + a.id + '">' + svg("volume", 20) + '语音播报</button>' +
      '</div>';
    return html; // 详情页无底部 Tab
  }

  /* ---------------- 路由 ---------------- */
  function route() {
    var h = location.hash.replace(/^#\/?/, "");
    var parts = h.split("/");
    var html, showTab = true;
    if (parts[0] === "detail" && parts[1]) { html = renderDetail(parts[1]); showTab = false; }
    else if (parts[0] === "category") { html = renderCategory(); }
    else if (parts[0] === "favorites") { html = renderFavorites(); }
    else if (parts[0] === "me") { html = renderMe(); }
    else { html = renderHome(); }
    mountPage(html, showTab);
  }

  // 统一挂载：页面字符串内含 .topbar / .view / .tabbar 三段（详情仅含 .topbar+.view）
  function mountPage(html, showTab) {
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    var tb = tmp.querySelector(".topbar");
    var vw = tmp.querySelector(".view");
    var tab = tmp.querySelector(".tabbar");
    document.getElementById("topbar").innerHTML = tb ? tb.innerHTML : "";
    document.getElementById("view").innerHTML = vw ? vw.innerHTML : "";
    var tabEl = document.getElementById("tabbar");
    tabEl.style.display = showTab ? "flex" : "none";
    if (tab) tabEl.innerHTML = tab.innerHTML;
    window.scrollTo(0, 0);
  }

  /* ---------------- 弹层 / Toast ---------------- */
  function dialog(opts) {
    var root = document.getElementById("dialog-root");
    root.innerHTML =
      '<div class="overlay">' +
      '<div class="dialog" data-stop="1">' +
      '<h3>' + esc(opts.title) + '</h3>' +
      '<div class="d-body">' + opts.body + '</div>' +
      '<div class="d-actions">' +
      (opts.cancel !== false ? '<button class="btn btn-ghost" data-action="dismiss">取消</button>' : '') +
      '<button class="btn ' + (opts.accent ? "btn-accent" : "btn-primary") + '" data-action="confirm">继续</button>' +
      '</div></div></div>';
    root._onConfirm = opts.onConfirm;
  }
  function closeDialog() { document.getElementById("dialog-root").innerHTML = ""; }
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById("toast-root");
    t.innerHTML = '<div class="toast show">' + esc(msg) + '</div>';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.innerHTML = ""; }, 1800);
  }

  /* ---------------- 防诈骗确认 ---------------- */
  function confirmSignup(a) {
    var signup = a.signup || "现场报名";
    var domain = "";
    try { if (/^https?:\/\//.test(signup)) domain = new URL(signup).hostname; } catch (e) {}
    var body = '您即将通过「<b>' + esc(signup) + '</b>」报名「' + esc(a.title) + '」。' +
      (domain ? '<br/>报名网址域名：<span class="mono">' + esc(domain) + '</span>' : '') +
      '<br/><br/><span class="warn">安全提醒：</span><br/>· old-buddy 不代收任何费用，请勿向任何个人转账。<br/>' +
      '· 请核对活动真实性，谨防假冒社区 / 机构的诈骗。<br/>' +
      '· 报名请走官方渠道，不要轻信陌生链接。';
    dialog({
      title: "安全报名提醒", body: body, accent: true,
      onConfirm: function () {
        closeDialog();
        if (/^https?:\/\//.test(signup)) { window.open(signup, "_blank"); toast("已打开报名页面，请核对网址"); }
        else { toast("请按「" + signup + "」方式报名"); }
      }
    });
  }

  /* ---------------- 全局点击 ---------------- */
  function onClick(e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var action = el.getAttribute("data-action");
    var id = el.getAttribute("data-id");
    var key = el.getAttribute("data-key");
    var tab = el.getAttribute("data-tab");
    var r = el.getAttribute("data-r");
    var cat = el.getAttribute("data-cat");

    // 弹层内
    if (action === "dismiss") { closeDialog(); return; }
    if (action === "confirm") {
      var fn = document.getElementById("dialog-root")._onConfirm;
      closeDialog();
      if (fn) fn();
      return;
    }

    // fav 需阻止冒泡触发 open
    if (action === "fav") { e.stopPropagation(); var a = state.index[id]; if (a) { toggleFav(a); route(); } return; }

    switch (action) {
      case "tab": location.hash = "#/" + tab; break;
      case "open": location.hash = "#/detail/" + id; break;
      case "back": history.back(); break;
      case "setRadius":
        state.radius = parseInt(r, 10); persist(); route(); break;
      case "goCategory":
        state.selectedCategory = cat || null; location.hash = "#/category"; break;
      case "pickCat":
        state.selectedCategory = (cat === "" ? null : cat); route(); break;
      case "locate": requestLocate(); break;
      case "toggleFont":
        state.settings.largeFont = !state.settings.largeFont; persist(); applySize(); route(); break;
      case "toggle":
        state.settings[key] = !state.settings[key]; persist(); route(); break;
      case "refresh": doRefresh(); break;
      case "nav": doNav(state.index[id]); break;
      case "signup": confirmSignup(state.index[id]); break;
      case "speak": speak(descOf(state.index[id])); break;
      case "antiFraud": showAntiFraud(); break;
      case "about": showAbout(); break;
    }
  }

  function applySize() {
    document.body.setAttribute("data-size", state.settings.largeFont ? "lg" : "sm");
  }
  function requestLocate() {
    if (!navigator.geolocation) { toast("当前环境不支持定位"); return; }
    toast("正在获取您的位置…");
    navigator.geolocation.getCurrentPosition(function (p) {
      state.location = { lat: p.coords.latitude, lng: p.coords.longitude, name: "我的位置", authorized: true };
      persist(); toast("已更新定位");
      loadData().then(route);
    }, function () { toast("定位失败，仍用演示点"); });
  }
  function doNav(a) {
    if (!a) return;
    var url = "https://uri.amap.com/marker?position=" + a.lng + "," + a.lat +
      "&name=" + encodeURIComponent(a.title) + "&src=oldbuddy&coordinate=wgs84&callnative=1";
    window.open(url, "_blank");
  }
  function doRefresh() {
    toast("已刷新附近活动");
    loadData().then(function () { route(); toast("附近活动已更新"); });
  }
  function showAntiFraud() {
    dialog({
      title: "防骗须知", cancel: false,
      body: '<b>老友时光防诈骗提示：</b><br/>' +
        '1. 平台所有活动信息均来自公开聚合，<span class="warn">old-buddy 不代收任何费用</span>。<br/>' +
        '2. 报名请走官方渠道（社区中心 / 文化云等），不要向个人转账。<br/>' +
        '3. 凡要求预付押金、手续费、保证金的，极可能是诈骗。<br/>' +
        '4. 陌生链接、陌生二维码不要随意点开。<br/>' +
        '5. 拿不准时，可先到就近社区文化活动中心当面核实。'
    });
  }
  function showAbout() {
    dialog({
      title: "关于老友时光", cancel: false,
      body: '老友时光是一款面向 50–60 岁退休朋友的小程序。<br/><br/>' +
        'AI 自动聚合上海全市社区、文化、老年教育活动，您打开后按手机定位，就能看到<b>附近 1 公里（可放大到 3/5/10 公里）本周有哪些活动</b>。<br/><br/>' +
        '大字模式、语音播报、防诈骗提示，都为看得清、听得懂、更安全而设计。'
    });
  }

  /* ---------------- 数据加载 ---------------- */
  function loadData() {
    state.data.byRadius = {}; state.data.stats = {};
    return Promise.all(RADII.map(function (r) {
      return apiNearby(state.location.lat, state.location.lng, r).then(function (d) {
        state.data.byRadius[r] = d.nearby || []; state.data.stats[r] = d.count || 0;
      }).catch(function () { state.data.byRadius[r] = []; state.data.stats[r] = 0; });
    })).then(buildIndex);
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    loadPersisted();
    applySize();
    document.addEventListener("click", onClick);
    document.getElementById("view").innerHTML = '<div class="loading">正在加载附近活动…</div>';
    if (!location.hash) location.hash = "#/home";
    loadData().then(function () {
      route();
      window.addEventListener("hashchange", route);
      if (state.settings.voice && state.index) {/* 语音在详情页触发，这里不自动播 */}
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
