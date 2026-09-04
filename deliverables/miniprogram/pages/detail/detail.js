const app = getApp();
const storage = require("../../services/storage.js");
const cloud = require("../../services/cloud.js");

Page({
  data: { activity: null, fav: false, iconName: "music", isCourse: false, booked: false },

  onLoad(opt) {
    const id = decodeURIComponent(opt.id || "");
    let a = (app.globalData.data.nearby || []).find((x) => String(x.id) === String(id));
    if (!a) a = (app.globalData.courses || []).find((x) => String(x.id) === String(id));
    if (!a) a = storage.getFavorites().find((x) => String(x.id) === String(id));
    if (!a) a = (app.globalData.bookings || []).find((x) => String(x.id) === String(id));
    if (!a) {
      wx.showToast({ title: "活动不存在", icon: "none" });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    const isCourse = a.kind === "course";
    const iconName = a.type === "运动" ? "activity" : a.type === "公益" ? "heartPulse" : "music";
    this.setData({ activity: a, iconName, fav: storage.isFavorite(id), isCourse, booked: app.isBooked(id) });
  },

  onNav() {
    const a = this.data.activity;
    if (a && a.lat && a.lng) {
      wx.openLocation({ latitude: a.lat, longitude: a.lng, name: a.title, address: a.address || a.venue });
    } else {
      wx.showToast({ title: "暂无坐标信息", icon: "none" });
    }
  },

  onSignup() {
    const a = this.data.activity;
    const isCourse = this.data.isCourse;
    wx.showModal({
      title: isCourse ? "报名防骗确认" : "参加防骗确认",
      content: "即将为您登记报名：" + (a.title || "") + "。报名与缴费请仅通过官方渠道，凡要求您转账、提供短信验证码或付费代抢名额的，均为诈骗。",
      confirmText: isCourse ? "确认报名" : "确认参加",
      cancelText: "取消",
      success: (r) => {
        if (r.confirm) {
          app.addBooking(a);
          this.setData({ booked: true });
          wx.showToast({ title: "已记入我的报名", icon: "none" });
          setTimeout(() => wx.navigateTo({ url: "/pages/bookings/bookings" }), 700);
        }
      }
    });
  },

  onFav() {
    const a = this.data.activity;
    if (!a) return;
    const nowFav = storage.toggleFavorite({ id: a.id, title: a.title, type: a.type, venue: a.venue, address: a.address, time: a.time, lat: a.lat, lng: a.lng, fee: a.fee });
    // 云开发已开通 -> 收藏同步到云端（失败不影响本地体验）
    if (cloud.isReady()) { cloud.toggleFavorite(a.id).catch(() => {}); }
    this.setData({ fav: nowFav });
  }
});
