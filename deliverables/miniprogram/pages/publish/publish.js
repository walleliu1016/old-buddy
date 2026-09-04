// pages/publish/publish.js — 发布兴趣活动 / 我发布的
// 云开发已开通 → publish 云函数（含内容安全）；未开通 → 本机暂存，功能不断
const app = getApp();
const cloud = require("../../services/cloud.js");

const CATS = ["文艺", "学习", "运动", "公益", "市集"];
const LS_KEY = "local_posts"; // 未开云时的本机暂存

Page({
  data: {
    tab: "post",              // post=发布 | mine=我发布的
    isCloud: false,
    bigFont: false,
    /* 表单 */
    cats: CATS,
    cat: "公益",
    title: "",
    date: "", time: "14:00",
    venue: "", address: "",
    feeMode: "free",          // free | paid
    price: "",
    capacity: "",
    desc: "",
    contact: "",
    submitting: false,
    /* 我发布的 */
    mine: [], mineLoaded: false
  },

  onLoad(options) {
    const set = (app.globalData.settings || {});
    this.setData({ isCloud: cloud.isReady(), bigFont: !!set.bigFont });
    if (options && options.tab === "mine") this.switchTab("mine");
  },

  onShow() {
    if (this.data.tab === "mine") this.loadMine();
  },

  switchTab(t) {
    this.setData({ tab: t });
    if (t === "mine") this.loadMine();
  },
  onTapTab(e) { this.switchTab(e.currentTarget.dataset.tab); },

  /* ---------------- 表单交互 ---------------- */
  onTitle(e) { this.setData({ title: e.detail.value }); },
  onVenue(e) { this.setData({ venue: e.detail.value }); },
  onAddress(e) { this.setData({ address: e.detail.value }); },
  onPrice(e) { this.setData({ price: e.detail.value }); },
  onCapacity(e) { this.setData({ capacity: e.detail.value }); },
  onDesc(e) { this.setData({ desc: e.detail.value }); },
  onContact(e) { this.setData({ contact: e.detail.value }); },
  onDate(e) { this.setData({ date: e.detail.value }); },
  onTime(e) { this.setData({ time: e.detail.value }); },
  pickCat(e) { this.setData({ cat: e.currentTarget.dataset.cat }); },
  pickFee(e) { this.setData({ feeMode: e.currentTarget.dataset.m }); },

  minDate() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  },

  buildTimeText() {
    const dt = this.data.date;                 // "2026-09-20" 或空
    const tm = this.data.time;                 // "14:00"
    let label = "";
    if (dt) {
      const p = dt.split("-");
      label = Number(p[1]) + "月" + Number(p[2]) + "日";
    } else {
      const d = new Date();
      label = (d.getMonth() + 1) + "月" + d.getDate() + "日";
    }
    return tm ? (label + " " + tm) : label;
  },

  validate() {
    if (this.data.title.trim().length < 2) return "活动名称至少 2 个字";
    if (!this.data.venue.trim()) return "请填写活动地点名称";
    if (!this.data.address.trim()) return "请填写详细地址";
    if (this.data.feeMode === "paid" && !(Number(this.data.price) > 0)) return "请填写收费金额";
    return null;
  },

  /* ---------------- 提交 ---------------- */
  onSubmit() {
    const err = this.validate();
    if (err) { wx.showToast({ title: err, icon: "none" }); return; }
    if (this.data.submitting) return;
    this.setData({ submitting: true });

    const loc = app.globalData.location || {};
    const payload = {
      title: this.data.title.trim(),
      category: this.data.cat,
      timeText: this.buildTimeText(),
      venue: this.data.venue.trim(),
      address: this.data.address.trim(),
      lat: loc.lat, lng: loc.lng,
      price: this.data.feeMode === "paid" ? Math.round(Number(this.data.price) * 100) : 0,
      capacity: Number(this.data.capacity) || 0,
      description: this.data.desc.trim(),
      contact: this.data.contact.trim()
    };

    if (cloud.isReady()) {
      cloud.publishCreate(payload).then((r) => {
        this.setData({ submitting: false });
        wx.showToast({ title: "发布成功", icon: "success" });
        this.resetForm();
        this.switchTab("mine");
      }).catch((e) => {
        this.setData({ submitting: false });
        wx.showToast({ title: e.message || "发布失败，请重试", icon: "none" });
      });
    } else {
      // 未开通云开发：本机暂存，开通后可重新发布
      const list = wx.getStorageSync(LS_KEY) || [];
      list.unshift(Object.assign({ id: "local_" + Date.now(), status: "本机暂存", createdAt: Date.now() }, payload));
      wx.setStorageSync(LS_KEY, list);
      this.setData({ submitting: false });
      wx.showToast({ title: "已保存到本机（未连云端）", icon: "none", duration: 2000 });
      this.resetForm();
      this.switchTab("mine");
    }
  },

  resetForm() {
    this.setData({ title: "", venue: "", address: "", price: "", capacity: "", desc: "", contact: "", feeMode: "free" });
  },

  /* ---------------- 我发布的 ---------------- */
  loadMine() {
    if (cloud.isReady()) {
      cloud.publishMine().then((d) => {
        this.setData({ mine: this.fmt(d.list || []), mineLoaded: true });
      }).catch(() => {
        this.setData({ mine: [], mineLoaded: true });
      });
    } else {
      this.setData({ mine: this.fmt(wx.getStorageSync(LS_KEY) || []), mineLoaded: true });
    }
  },

  fmt(list) {
    return (list || []).map((x) => ({
      id: x._id || x.id,
      title: x.title, category: x.category || "公益",
      timeText: x.timeText || "", venue: x.venue || "",
      fee: x.price > 0 ? "¥" + (x.price / 100) : "免费",
      status: x.status === "offline" ? "已下架" : (x.status === "本机暂存" ? "本机暂存" : "已发布")
    }));
  },

  onOffline(e) {
    const id = e.currentTarget.dataset.id;
    const that = this;
    wx.showModal({
      title: "下架活动",
      content: "下架后其他人就看不到了，确定吗？",
      confirmText: "确定下架",
      cancelText: "再想想",
      success(res) {
        if (!res.confirm) return;
        if (cloud.isReady() && String(id).indexOf("local_") !== 0) {
          cloud.publishOffline(id).then(() => that.loadMine())
            .catch((er) => wx.showToast({ title: er.message || "操作失败", icon: "none" }));
        } else {
          const list = (wx.getStorageSync(LS_KEY) || []).filter((x) => (x._id || x.id) !== id);
          wx.setStorageSync(LS_KEY, list);
          that.loadMine();
        }
      }
    });
  }
});
