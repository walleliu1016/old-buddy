// services/cloud.js —— 云开发统一调用层
//
// 作用：把云函数返回（_id/category/timeText）适配成现有页面在用的字段（id/type/time），
//       因此**页面代码一行都不用改**。
// 未开通云开发时 isReady() 返回 false，由 activity.js 自动降级到本地数据服务。
const config = require('../config.js');

function isReady() {
  return !!(config.cloud.enabled && config.cloud.env && typeof wx !== 'undefined' && wx.cloud);
}

function init() {
  if (!isReady()) return false;
  try {
    wx.cloud.init({ env: config.cloud.env, traceUser: true });
    return true;
  } catch (e) {
    return false;
  }
}

/** 调用云函数，统一剥壳 + 错误归一 */
function call(name, data) {
  return wx.cloud.callFunction({ name: name, data: data || {} })
    .then((res) => {
      const r = res && res.result ? res.result : {};
      if (r.code !== undefined && r.code !== 0) {
        const err = new Error(r.msg || ('云函数错误 ' + r.code));
        err.code = r.code;
        throw err;
      }
      return r.data !== undefined ? r.data : r;
    });
}

/* ---------- 字段适配：后端文档 -> 页面字段 ---------- */
function toItem(a) {
  if (!a) return a;
  return Object.assign({}, a, {
    id: a._id || a.id,
    type: a.category || a.type,
    time: a.timeText || a.time,
    fav: !!a.isFav,
    booked: !!a.isBooked
  });
}

module.exports = {
  isReady: isReady,
  init: init,
  call: call,
  toItem: toItem,

  /* ---- 登录 / 用户 ---- */
  login(extra) { return call('login', extra || {}); },
  me() { return call('user', { action: 'get' }); },
  updateMe(patch) { return call('user', Object.assign({ action: 'update' }, patch)); },
  bindPhone(cloudID) { return call('user', { action: 'phone', cloudID: cloudID }); },

  /* ---- 活动 / 课程 ---- */
  nearby(lat, lng, radius, name, category) {
    return call('activities', { action: 'nearby', lat: lat, lng: lng,
      radius: radius, name: name, category: category || 'all' })
      .then((d) => ({
        count: d.count, radius_km: d.radius_km, stats: d.stats || {},
        nearby: (d.list || []).map(toItem)
      }));
  },
  courses(lat, lng, name, category) {
    return call('activities', { action: 'courses', lat: lat, lng: lng,
      name: name, category: category || 'all' })
      .then((d) => ({ count: d.count, courses: (d.list || []).map(toItem) }));
  },
  detail(id) { return call('activities', { action: 'detail', id: id }).then(toItem); },

  /* ---- 报名（订单） ---- */
  bookings(status) {
    return call('booking', { action: 'list', status: status || 'all' })
      .then((d) => (d && d.list ? d.list : []).map(toItem));
  },
  createBooking(activityId) { return call('booking', { action: 'create', activityId: activityId }); },
  cancelBooking(id, reason) { return call('booking', { action: 'cancel', id: id, reason: reason || '' }); },
  checkin(id) { return call('booking', { action: 'checkin', id: id }); },

  /* ---- 收藏 ---- */
  favorites() { return call('favorite', { action: 'list' }); },
  toggleFavorite(activityId) { return call('favorite', { action: 'toggle', activityId: activityId }); },

  /* ---- 反馈 / 订阅 ---- */
  feedback(payload) { return call('feedback', payload); },
  subscribe(templateId, type) { return call('message', { action: 'subscribe', templateId: templateId, type: type }); },

  /* ---- 用户发布兴趣活动 ---- */
  publishCreate(payload) { return call('publish', Object.assign({ action: 'create' }, payload)); },
  publishMine() { return call('publish', { action: 'mine' }).then((d) => (d && d.list) || []); },
  publishOffline(id) { return call('publish', { action: 'offline', id: id }); },

  /* ---- 运维 ---- */
  sync() { return call('sync', { action: 'run' }); }
};
