/* store.js — 全局状态 + 本地持久化（收藏 / 报名 / 设置 / 定位 / 半径） */
(function () {
  window.OB = window.OB || {};

  // 分类（与种子数据 type 对齐）
  OB.CATEGORIES = [
    { key: "all", label: "全部", icon: "grid" },
    { key: "文艺", label: "文艺", icon: "music" },
    { key: "学习", label: "学习", icon: "bookOpen" },
    { key: "运动", label: "运动", icon: "activity" },
    { key: "公益", label: "公益", icon: "heartPulse" },
    { key: "市集", label: "市集", icon: "bag" }
  ];
  OB.RADII = [1, 3, 5, 10];
  OB.DEFAULT_USER = { lat: 31.2304, lng: 121.4737, name: "人民广场" };

  // 报名（订单）状态
  OB.BK_PENDING = "待参加";
  OB.BK_DONE = "已结束";
  OB.BK_CANCELED = "已取消";

  var LS_FAV = "ob_fav_v2", LS_SET = "ob_set_v2", LS_LOC = "ob_loc_v2",
      LS_RAD = "ob_rad_v2", LS_BK = "ob_bk_v2";

  function load(key, def) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
    catch (e) { return def; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function today() {
    var d = new Date();
    return (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }

  // 演示用初始报名记录（真实环境由后端订单接口下发，此处仅本地持久化）
  var SEED_BOOKINGS = [
    { id: 25, kind: "course", title: "智能手机使用入门", type: "学习",
      venue: "上海市老年大学", address: "上海市黄浦区西藏中路", lat: 31.2300, lng: 121.4700,
      time: "每周二 09:00-10:30", schedule: "每周二 09:00-10:30", weeks: "8 周",
      start: "9月15日开课", fee: "免费", status: OB.BK_PENDING, bookedAt: "8月30日" },
    { id: 3, kind: "once", title: "经典歌剧导赏", type: "文艺",
      venue: "上海大剧院", address: "上海市黄浦区人民大道300号", lat: 31.2305, lng: 121.4735,
      time: "周五 19:30", fee: "¥80", status: OB.BK_DONE, bookedAt: "8月22日" }
  ];

  OB.store = {
    state: {
      location: load(LS_LOC, OB.DEFAULT_USER),
      radius: load(LS_RAD, 1),
      data: { nearby: [], stats: {} },
      courses: [],
      courseCat: "all",
      bkTab: "pending",
      bookings: load(LS_BK, SEED_BOOKINGS),
      favorites: load(LS_FAV, []),
      settings: Object.assign({ bigFont: false, voice: false }, load(LS_SET, {})),
      category: "all",
      detailId: null
    },
    setLocation: function (loc) { this.state.location = loc; save(LS_LOC, loc); },
    setRadius: function (r) { this.state.radius = r; save(LS_RAD, r); },
    setData: function (d) { this.state.data = d; },
    setCourses: function (list) { this.state.courses = list; },
    setCourseCat: function (c) { this.state.courseCat = c; },

    isFav: function (id) { return this.state.favorites.some(function (f) { return f.id === id; }); },
    toggleFav: function (item) {
      var favs = this.state.favorites;
      var i = favs.findIndex(function (f) { return f.id === item.id; });
      if (i >= 0) favs.splice(i, 1); else favs.unshift(item);
      save(LS_FAV, favs);
      return i < 0;
    },
    getFavs: function () { return this.state.favorites; },

    /* ---- 报名（订单） ---- */
    getBookings: function () { return this.state.bookings; },
    isBooked: function (id) {
      return this.state.bookings.some(function (b) {
        return String(b.id) === String(id) && b.status !== OB.BK_CANCELED;
      });
    },
    addBooking: function (a) {
      if (this.isBooked(a.id)) return false;
      this.state.bookings.unshift({
        id: a.id, kind: a.kind || "once", title: a.title, type: a.type,
        venue: a.venue, address: a.address, lat: a.lat, lng: a.lng,
        time: a.time, schedule: a.schedule, weeks: a.weeks, start: a.start,
        fee: a.fee, status: OB.BK_PENDING, bookedAt: today()
      });
      save(LS_BK, this.state.bookings);
      return true;
    },
    cancelBooking: function (id) {
      var b = this.state.bookings.filter(function (x) { return String(x.id) === String(id); })[0];
      if (!b) return false;
      b.status = OB.BK_CANCELED;
      save(LS_BK, this.state.bookings);
      return true;
    },
    pendingCount: function () {
      return this.state.bookings.filter(function (b) { return b.status === OB.BK_PENDING; }).length;
    },

    setSetting: function (k, v) { this.state.settings[k] = v; save(LS_SET, this.state.settings); },
    getById: function (id) {
      var all = this.state.data.nearby.concat(this.state.courses).concat(this.state.bookings);
      return all.filter(function (a) { return String(a.id) === String(id); })[0] || null;
    }
  };

  // 给“市集”补一个购物袋图标（icons 里没有，这里注入）
  OB.icons.bag = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';
})();
