const app = getApp();
const storage = require("../../services/storage.js");
const locationSrv = require("../../services/location.js");

Page({
  data: { settings: { bigFont: false, voice: false }, favCount: 0, favs: [], locationName: "人民广场", bigFont: false, pendingCount: 0 },

  onShow() {
    const set = app.globalData.settings;
    const favs = storage.getFavorites();
    this.setData({
      settings: { bigFont: set.bigFont, voice: set.voice },
      favs: favs,
      favCount: favs.length,
      locationName: app.globalData.location.name,
      bigFont: set.bigFont,
      pendingCount: app.pendingCount()
    });
  },

  onBookings() { wx.navigateTo({ url: "/pages/bookings/bookings" }); },

  onMyPosts() { wx.navigateTo({ url: "/pages/publish/publish?tab=mine" }); },

  onToggleFont() {
    const nf = !app.globalData.settings.bigFont;
    app.setSetting("bigFont", nf);
    this.setData({ "settings.bigFont": nf, bigFont: nf });
    wx.showToast({ title: nf ? "已开启大字模式" : "已关闭大字模式", icon: "none" });
  },
  onToggleVoice() {
    const nv = !app.globalData.settings.voice;
    app.setSetting("voice", nv);
    this.setData({ "settings.voice": nv });
    wx.showToast({ title: nv ? "已开启语音播报" : "已关闭语音播报", icon: "none" });
  },
  onLocate() {
    locationSrv.getLocation().then((loc) => { app.setLocation(loc); this.setData({ locationName: loc.name }); wx.showToast({ title: "已定位", icon: "none" }); })
      .catch(() => wx.showToast({ title: "定位未授权", icon: "none" }));
  },
  onFavList() {
    if (this.data.favs.length === 0) wx.showToast({ title: "还没有收藏", icon: "none" });
  },
  onOpenFav(e) {
    wx.navigateTo({ url: "/pages/detail/detail?id=" + e.currentTarget.dataset.id });
  },
  onAnti() {
    wx.showModal({ title: "防骗须知", content: "1. 报名与缴费只走官方渠道。\n2. 不向任何人透露短信验证码。\n3. 凡“代缴、代抢、内部名额”要钱的，都是诈骗。\n4. 遇可疑情况可拨打 96110。", showCancel: false, confirmText: "我记住了" });
  },
  onAbout() {
    wx.showModal({ title: "关于老友时光", content: "老友时光，帮 50-60 岁的您，按定位发现家门口的社区活动、课程与公益服务。活动由 AI 自动聚合上海公共文化资源。", showCancel: false, confirmText: "知道了" });
  }
});
