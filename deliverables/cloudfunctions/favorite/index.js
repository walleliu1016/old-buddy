// 云函数 favorite —— 收藏切换 / 收藏列表
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const cmd = db.command;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID || event.openid;
  if (!openid) return { code: 401, msg: '未登录' };
  if (event.action === 'toggle') return toggle(event, openid);
  if (event.action === 'list') return list(event, openid);
  return { code: 422, msg: 'unknown action' };
};

async function toggle(e, openid) {
  const { activityId } = e;
  if (!activityId) return { code: 422, msg: 'activityId 必填' };
  const exist = await db.collection('favorites').where({ userId: openid, activityId }).get();
  if (exist.data.length) {
    await db.collection('favorites').doc(exist.data[0]._id).remove();
    await db.collection('activities').doc(activityId)
      .update({ data: { favCount: cmd.inc(-1) } }).catch(() => {});
    return { code: 0, data: { isFav: false } };
  }
  await db.collection('favorites').add({ data: { userId: openid, activityId, createdAt: new Date() } });
  await db.collection('activities').doc(activityId)
    .update({ data: { favCount: cmd.inc(1) } }).catch(() => {});
  return { code: 0, data: { isFav: true } };
}

async function list(e, openid) {
  const favs = await db.collection('favorites')
    .where({ userId: openid }).orderBy('createdAt', 'desc').limit(100).get();
  if (!favs.data.length) return { code: 0, data: { list: [] } };
  const ids = favs.data.map(f => f.activityId);
  const acts = await db.collection('activities').where({ _id: cmd.in(ids) }).get().catch(() => ({ data: [] }));
  const map = {};
  (acts.data || []).forEach(a => { map[a._id] = a; });
  const list = favs.data.map(f => Object.assign({}, map[f.activityId] || {}, { activityId: f.activityId, isFav: true }))
    .filter(a => a.title);
  return { code: 0, data: { list } };
}
