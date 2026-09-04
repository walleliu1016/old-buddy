// app.js — 全局状态 + 启动初始化
const storage = require("./services/storage.js");
const cloudSrv = require("./services/cloud.js");

const SEED_BOOKINGS = [
  { id: 25, kind: "course", title: "智能手机使用入门", type: "学习",
    venue: "上海市老年大学", address: "上海市黄浦区西藏中路", lat: 31.2300, lng: 121.4700,
    time: "每周二 09:00-10:30", schedule: "每周二 09:00-10:30", weeks: "8 周",
    start: "9月15日开课", fee: "免费", status: "待参加", bookedAt: "8月30日" },
  { id: 3, kind: "once", title: "经典歌剧导赏", type: "文艺",
    venue: "上海大剧院", address: "上海市黄浦区人民大道300号", lat: 31.2305, lng: 121.4735,
    time: "周五 19:30", fee: "¥80", status: "已结束", bookedAt: "8月22日" }
];

App({
  globalData: {
    location: { lat: 31.2304, lng: 121.4737, name: "人民广场" },
    radius: 1,
    category: "all",
    courseCat: "all",
    bkTab: "pending",
    data: { nearby: [], stats: {} },
    courses: [],
    bookings: [],
    settings: { bigFont: false, voice: false }
  },

  onLaunch() {
    const loc = storage.getLocation();
    const set = storage.getSettings();
    const rad = storage.getRadius();
    if (loc) this.globalData.location = loc;
    if (typeof rad === "number") this.globalData.radius = rad;
    if (set) this.globalData.settings = Object.assign(this.globalData.settings, set);

    if (cloudSrv.isReady()) {
      // 云开发已开通：初始化 + 静默登录，再从云端拉取真实报名覆盖本地
      cloudSrv.init();
      cloudSrv.login()
        .then((user) => { this.globalData.currentUser = user; return cloudSrv.bookings('all'); })
        .then((bk) => { if (bk && bk.length) { this.globalData.bookings = bk; storage.saveBookings(bk); } })
        .catch(() => { this._seedBookings(); });
    } else {
      // 未开通云开发：沿用本地种子（功能不受影响）
      this._seedBookings();
    }
  },

  _seedBookings() {
    let bk = storage.getBookings();
    if (!bk || bk.length === 0) { bk = SEED_BOOKINGS; storage.saveBookings(bk); }
    this.globalData.bookings = bk;
  },

  // 供页面调用：更新全局后通知
  setLocation(loc) { this.globalData.location = loc; storage.saveLocation(loc); },
  setRadius(r) { this.globalData.radius = r; storage.saveRadius(r); },
  setData2(d) { this.globalData.data = d; },
  setCourses(list) { this.globalData.courses = list || []; },
  setCourseCat(c) { this.globalData.courseCat = c; },

  /* ---- 报名（订单） ---- */
  addBooking(a) {
    if (this.isBooked(a.id)) return false;
    const bk = this.globalData.bookings;
    bk.unshift({
      id: a.id, kind: a.kind || "once", title: a.title, type: a.type,
      venue: a.venue, address: a.address, lat: a.lat, lng: a.lng,
      time: a.time, schedule: a.schedule, weeks: a.weeks, start: a.start,
      fee: a.fee, status: "待参加", bookedAt: this._today()
    });
    storage.saveBookings(bk);
    // 云开发已开通 -> 落库到云（失败不影响本地体验）
    if (cloudSrv.isReady()) { cloudSrv.createBooking(a.id).catch(() => {}); }
    return true;
  },
  cancelBooking(id) {
    const bk = this.globalData.bookings;
    const b = bk.filter((x) => String(x.id) === String(id))[0];
    if (!b) return false;
    b.status = "已取消";
    storage.saveBookings(bk);
    // 云开发已开通 -> 同步取消
    if (cloudSrv.isReady()) { cloudSrv.cancelBooking(id, "用户取消").catch(() => {}); }
    return true;
  },
  isBooked(id) {
    return this.globalData.bookings.some((b) => String(b.id) === String(id) && b.status !== "已取消");
  },
  pendingCount() {
    return this.globalData.bookings.filter((b) => b.status === "待参加").length;
  },
  _today() {
    const d = new Date();
    return (d.getMonth() + 1) + "月" + d.getDate() + "日";
  },

  setSetting(k, v) {
    this.globalData.settings[k] = v;
    storage.saveSettings(this.globalData.settings);
  }
});
