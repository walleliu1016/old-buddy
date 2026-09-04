// services/activity.js — 活动数据访问层（云开发优先，未开通时自动降级到本地数据服务）
//
// 云开发已启用 -> 走 cloud.js（云函数 -> 云数据库）
// 云开发未启用 -> 走 config.legacy.base（v2 server.py），行为与此前完全一致
const config = require('../config.js');
const cloud = require('./cloud.js');

const BASE = config.legacy.base;

function normalize(list) {
  (list || []).forEach((a) => {
    if (a.distance_km != null) a.distance_km = Math.round(a.distance_km * 10) / 10;
  });
  return list || [];
}

/* ---------------- 本地/局域网数据服务（降级通道） ---------------- */
function legacyNearby(lat, lng, radius, name) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE + '/nearby',
      data: { lat: lat, lng: lng, radius: radius, name: name || '' },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const d = res.data || {};
          resolve(Object.assign({}, d, { nearby: normalize(d.nearby) }));
        } else reject(new Error('HTTP ' + res.statusCode));
      },
      fail: (err) => reject(err)
    });
  });
}

function legacyCourses(lat, lng, name) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE + '/courses',
      data: { lat: lat, lng: lng, name: name || '' },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const d = res.data || {};
          resolve(Object.assign({}, d, { courses: normalize(d.courses) }));
        } else reject(new Error('HTTP ' + res.statusCode));
      },
      fail: (err) => reject(err)
    });
  });
}

/* ---------------- 对外接口（与页面调用签名保持不变） ---------------- */
function nearby(lat, lng, radius, name) {
  if (cloud.isReady()) return cloud.nearby(lat, lng, radius, name);
  return legacyNearby(lat, lng, radius, name);
}

// 「课程」页：全城长期课，不受半径限制
function courses(lat, lng, name) {
  if (cloud.isReady()) return cloud.courses(lat, lng, name);
  return legacyCourses(lat, lng, name);
}

// 详情：云开发走云函数；降级通道从已加载的数据里找
function detail(id) {
  if (cloud.isReady()) return cloud.detail(id);
  return new Promise((resolve, reject) => {
    const all = (getApp().globalData.data.nearby || [])
      .concat(getApp().globalData.courses || [])
      .concat(getApp().globalData.bookings || []);
    const hit = all.filter((a) => String(a.id) === String(id))[0];
    hit ? resolve(hit) : reject(new Error('not found'));
  });
}

function refresh() {
  if (cloud.isReady()) return cloud.sync();
  return new Promise((resolve) => {
    wx.request({
      url: BASE + '/refresh',
      success: (r) => resolve(r.data),
      fail: () => resolve({ ok: false })
    });
  });
}

module.exports = {
  nearby: nearby,
  courses: courses,
  detail: detail,
  refresh: refresh,
  BASE: BASE,
  isCloud: function () { return cloud.isReady(); }
};
