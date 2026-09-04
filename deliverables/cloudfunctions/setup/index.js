// 云函数 setup —— 一次性建集合（幂等），索引在控制台建（见 DEPLOY.md）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const COLLECTIONS = [
  'users', 'activities', 'bookings', 'favorites', 'feedbacks',
  'messages', 'orgs', 'sync_logs', 'ai_summaries', 'categories'
];

exports.main = async () => {
  const created = [], existed = [], errors = [];
  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name);
      created.push(name);
    } catch (e) {
      const msg = (e && e.message) || String(e);
      if (/already|exist/i.test(msg)) existed.push(name);
      else errors.push({ name, err: msg });
    }
  }
  return {
    code: 0,
    created, existed, errors,
    indexHint: [
      'activities.location  → 2dsphere（地理索引，半径查询必需）',
      'activities.kind + activities.status  → 普通索引',
      'activities.organizer  → 普通索引',
      'bookings.userId + bookings.activityId  → 普通索引',
      'bookings(userId, activityId, status)  → 复合索引（防重复报名）',
      'favorites.userId + favorites.activityId  → 普通索引',
      'users.openid  → 唯一索引',
      'messages.userId + messages.sendAt  → 普通索引',
      'ai_summaries.scope + scopeKey + period  → 普通索引'
    ]
  };
};
