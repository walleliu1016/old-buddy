const app = getApp();
const activitySrv = require("../../services/activity.js");
const storage = require("../../services/storage.js");
const locationSrv = require("../../services/location.js");
const cloud = require("../../services/cloud.js");

const CATEGORIES = [
  { key: "all", label: "全部", icon: "grid" },
  { key: "文艺", label: "文艺", icon: "music" },
  { key: "学习", label: "学习", icon: "bookOpen" },
  { key: "运动", label: "运动", icon: "activity" },
  { key: "公益", label: "公益", icon: "heartPulse" },
  { key: "市集", label: "市集", icon: "bag" }
];

function greetWord() {
  const h = new Date().getHours();
  if (h < 5) return "夜深了";
  if (h < 11) return "上午好";
  if (h < 13) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

function catLabelOf(key) {
  const c = CATEGORIES.filter((x) => x.key === key)[0];
  return c ? c.label : "全部";
}

Page({
  data: {
    greeting: "上午好", locationName: "人民广场", radius: 1, radii: [1, 3, 5, 10],
    stats: {}, feed: [], categories: CATEGORIES, summary: 0, loading: false, bigFont: false,
    catLabel: "全部",
    showFilter: false, fselRadius: 1, fselCat: "all"
  },

  onLoad() {
    const cat = app.globalData.category || "all";
    this.setData({
      greeting: greetWord(), radius: app.globalData.radius,
      locationName: app.globalData.location.name, bigFont: app.globalData.settings.bigFont,
      catLabel: catLabelOf(cat)
    });
  },
  onShow() {
    const cat = app.globalData.category || "all";
    this.setData({
      bigFont: app.globalData.settings.bigFont, radius: app.globalData.radius,
      locationName: app.globalData.location.name, catLabel: catLabelOf(cat)
    });
    this.load();
  },
  onPullDownRefresh() { this.load(() => wx.stopPullDownRefresh()); },

  load(done) {
    const loc = app.globalData.location, r = app.globalData.radius;
    const cat = app.globalData.category || "all";
    this.setData({ loading: true, radius: r, locationName: loc.name, catLabel: catLabelOf(cat), fselCat: cat });
    activitySrv.nearby(loc.lat, loc.lng, r, loc.name).then((d) => {
      const favs = storage.getFavorites();
      let list = (d.nearby || []);
      if (cat && cat !== "all") list = list.filter((a) => a.type === cat);
      const feed = list.map((a) => Object.assign({}, a, { fav: favs.some((f) => f.id === a.id) }));
      const stats = d.stats || {};
      this.setData({
        feed, stats,
        summary: stats[r] != null ? stats[r] : (d.nearby || []).length,
        loading: false
      });
      app.setData2(d);
      if (done) done();
    }).catch(() => {
      this.setData({ feed: [], stats: {}, loading: false });
      if (done) done();
      wx.showToast({ title: "网络不可用", icon: "none" });
    });
  },

  /* 筛选弹层 */
  openFilter() {
    this.setData({ showFilter: true, fselRadius: this.data.radius, fselCat: app.globalData.category || "all" });
  },
  pickRadius(e) { this.setData({ fselRadius: Number(e.currentTarget.dataset.r) }); },
  pickCat(e) { this.setData({ fselCat: e.currentTarget.dataset.cat }); },
  resetFilter() { this.setData({ fselRadius: 1, fselCat: "all" }); },
  applyFilter() {
    app.setRadius(this.data.fselRadius);
    app.globalData.category = this.data.fselCat;
    this.setData({ showFilter: false });
    this.load();
    wx.showToast({ title: "已更新筛选", icon: "none" });
  },
  closeFilter() { this.setData({ showFilter: false }); },
  noop() {},

  /* 快捷分类：等价于筛选 sheet 里选分类后点「查看结果」（距离不变） */
  onQuickCat(e) {
    const cat = e.currentTarget.dataset.cat;
    app.globalData.category = cat;
    this.setData({ fselCat: cat, catLabel: catLabelOf(cat) });
    this.load();
  },

  onCardTap(e) { wx.navigateTo({ url: "/pages/detail/detail?id=" + e.detail.id }); },
  onCardFav(e) {
    const id = e.detail.id;
    const item = this.data.feed.find((a) => a.id === id);
    if (!item) return;
    const nowFav = storage.toggleFavorite({ id: item.id, title: item.title, type: item.type, venue: item.venue, address: item.address, time: item.time, lat: item.lat, lng: item.lng, fee: item.fee });
    // 云开发已开通 -> 收藏同步到云端（失败不影响本地体验）
    if (cloud.isReady()) { cloud.toggleFavorite(item.id).catch(() => {}); }
    const feed = this.data.feed.map((a) => (a.id === id ? Object.assign({}, a, { fav: nowFav }) : a));
    this.setData({ feed });
  },

  onLocate() {
    locationSrv.getLocation().then((loc) => { app.setLocation(loc); this.load(); wx.showToast({ title: "已定位", icon: "none" }); })
      .catch(() => wx.showToast({ title: "定位未授权", icon: "none" }));
  },
  onRefresh() { this.load(); wx.showToast({ title: "已刷新", icon: "none" }); },

  goPublish() { wx.navigateTo({ url: "/pages/publish/publish" }); }
});
