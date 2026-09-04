const app = getApp();

Page({
  data: { list: [], tab: "pending", pendingCount: 0, total: 0, bigFont: false },

  onShow() {
    this.setData({ bigFont: app.globalData.settings.bigFont });
    this.apply(app.globalData.bkTab || "pending");
  },

  apply(tab) {
    const all = app.globalData.bookings || [];
    const pending = all.filter((b) => b.status === "待参加");
    const list = tab === "pending" ? pending : all;
    this.setData({ tab, list, pendingCount: pending.length, total: all.length });
  },

  onTab(e) {
    const t = e.currentTarget.dataset.tab;
    app.globalData.bkTab = t;
    this.apply(t);
  },
  goHome() {
    wx.switchTab({ url: "/pages/home/home" });
  },
  onCardTap(e) {
    wx.navigateTo({ url: "/pages/detail/detail?id=" + e.currentTarget.dataset.id });
  },
  onCancel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: "取消报名",
      content: "确定取消这一条报名记录吗？取消后名额将释放给其他人。",
      confirmText: "确认取消", cancelText: "再想想",
      success: (r) => {
        if (r.confirm) {
          app.cancelBooking(id);
          this.apply(this.data.tab);
          wx.showToast({ title: "已取消报名", icon: "none" });
        }
      }
    });
  }
});
