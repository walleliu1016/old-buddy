const app = getApp();
const activitySrv = require("../../services/activity.js");

const CATEGORIES = [
  { key: "all", label: "全部", icon: "grid" },
  { key: "文艺", label: "文艺", icon: "music" },
  { key: "学习", label: "学习", icon: "bookOpen" },
  { key: "运动", label: "运动", icon: "activity" },
  { key: "公益", label: "公益", icon: "heartPulse" },
  { key: "市集", label: "市集", icon: "bag" }
];

function catLabelOf(key) {
  const c = CATEGORIES.filter((x) => x.key === key)[0];
  return c ? c.label : "全部";
}

Page({
  data: {
    categories: CATEGORIES, courseCat: "all", catLabel: "全部",
    list: [], loading: false, bigFont: false
  },

  onShow() {
    const cat = app.globalData.courseCat || "all";
    this.setData({ bigFont: app.globalData.settings.bigFont, courseCat: cat, catLabel: catLabelOf(cat) });
    this.load();
  },
  onPullDownRefresh() { this.load(() => wx.stopPullDownRefresh()); },

  load(done) {
    const loc = app.globalData.location;
    this.setData({ loading: true });
    activitySrv.courses(loc.lat, loc.lng, loc.name).then((d) => {
      app.setCourses(d.courses || []);
      this.applyFilter(d.courses || []);
      this.setData({ loading: false });
      if (done) done();
    }).catch(() => {
      this.setData({ list: [], loading: false });
      if (done) done();
      wx.showToast({ title: "网络不可用", icon: "none" });
    });
  },

  applyFilter(courses) {
    const cat = this.data.courseCat;
    const list = courses.map((c) => Object.assign({}, c, {
      free: /免费|0\s*元|免收/.test(c.fee || ""),
      booked: app.isBooked(c.id)
    }));
    const filtered = cat === "all" ? list : list.filter((c) => c.type === cat);
    this.setData({ list: filtered, catLabel: catLabelOf(cat) });
  },

  onCat(e) {
    const cat = e.currentTarget.dataset.cat;
    app.globalData.courseCat = cat;
    this.setData({ courseCat: cat });
    this.applyFilter(app.globalData.courses);
  },
  onCardTap(e) {
    wx.navigateTo({ url: "/pages/detail/detail?id=" + e.currentTarget.dataset.id });
  }
});
