// 云函数 activities —— 附近 / 课程 / 详情（统一入口，按 event.action 分发）
// 首次运行若云数据库为空，会自动调用 sync 云函数从数据工厂拉一次（自愈）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const cmd = db.command;
const $ = db.command.aggregate;
const RADII = [1, 3, 5, 10];

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID || event.openid || '';
  const { action } = event;

  try {
    if (action === 'nearby') return await nearby(event, openid);
    if (action === 'courses') return await courses(event, openid);
    if (action === 'detail') return await detail(event, openid);
    return { code: 422, msg: 'unknown action' };
  } catch (e) {
    return { code: 500, msg: e.message || String(e) };
  }
};

async function ensureData() {
  const n = await db.collection('activities').count().catch(() => ({ total: 0 }));
  if (n.total > 0) return true;
  // 空库自愈：调 sync 拉一次
  try {
    await cloud.callFunction({ name: 'sync', data: { action: 'run', limit: 200 } });
    return (await db.collection('activities').count()).total > 0;
  } catch (e) {
    return false;
  }
}

// GET /activities/nearby —— 单次活动(once)，半径+分类+关键词，附多半径统计
async function nearby(e, openid) {
  const lat = Number(e.lat), lng = Number(e.lng);
  const radius = Number(e.radius || 1);
  const category = e.category || 'all';
  const keyword = e.keyword || '';
  const page = Number(e.page || 1), pageSize = Number(e.pageSize || 20);

  if (!isFinite(lat) || !isFinite(lng)) return { code: 422, msg: 'lat/lng 必填' };
  await ensureData();

  const where = { kind: 'once', status: 'active' };
  if (category !== 'all') where.category = category;
  if (keyword) where.title = db.RegExp({ regexp: keyword, options: 'i' });

  // 地理索引：以米为单位（radius km -> m）
  const res = await db.collection('activities').aggregate()
    .match(where)
    .append($.geoNear({
      near: db.Geo.Point(lng, lat),
      distanceField: 'distance_m',
      distanceMultiplier: 1,
      maxDistance: radius * 1000,
      spherical: true
    }))
    .sort({ distance_m: 1 })
    .skip((page - 1) * pageSize).limit(pageSize).end();

  const list = toKm(res.data);

  // 多半径统计（吸顶筛选条「1/3/5/10km 多少场」）
  const stats = {};
  for (const r of RADII) {
    const q = Object.assign({}, where, {
      location: cmd.geoWithin({ centerSphere: [[lng, lat], r / 6378.1] })
    });
    stats[String(r)] = (await db.collection('activities').where(q).count()).total;
  }

  return { code: 0, data: { count: list.length, radius_km: radius, stats, list: await decorate(list, openid) } };
}

// GET /courses —— 全城长期课，按距离排序（不受半径限制）
async function courses(e, openid) {
  const lat = Number(e.lat), lng = Number(e.lng);
  const category = e.category || 'all';
  const keyword = e.keyword || '';
  const page = Number(e.page || 1), pageSize = Number(e.pageSize || 20);
  if (!isFinite(lat) || !isFinite(lng)) return { code: 422, msg: 'lat/lng 必填' };
  await ensureData();

  const where = { kind: 'course', status: 'active' };
  if (category !== 'all') where.category = category;
  if (keyword) where.title = db.RegExp({ regexp: keyword, options: 'i' });

  const res = await db.collection('activities').aggregate()
    .match(where)
    .append($.geoNear({ near: db.Geo.Point(lng, lat), distanceField: 'distance_m', distanceMultiplier: 1, spherical: true }))
    .sort({ distance_m: 1 })
    .skip((page - 1) * pageSize).limit(pageSize).end();

  const list = toKm(res.data);
  return { code: 0, data: { count: list.length, list: await decorate(list, openid) } };
}

// GET /activities/:id
async function detail(e, openid) {
  let d;
  try {
    d = (await db.collection('activities').doc(e.id).get()).data;
  } catch (err) { d = null; }
  if (!d) return { code: 404, msg: '活动不存在' };

  const [fav, bk, related] = await Promise.all([
    openid ? db.collection('favorites').where({ userId: openid, activityId: e.id }).count() : { total: 0 },
    openid ? db.collection('bookings').where({ userId: openid, activityId: e.id, status: cmd.neq('cancelled') }).count() : { total: 0 },
    db.collection('activities').where({ organizer: d.organizer, _id: cmd.neq(e.id), status: 'active' }).limit(3).get().catch(() => ({ data: [] }))
  ]);
  return { code: 0, data: Object.assign({}, d, { isFav: fav.total > 0, isBooked: bk.total > 0, related: related.data }) };
}

// 米 -> 公里（保留 1 位）
function toKm(list) {
  return (list || []).map(a => {
    const m = a.distance_m;
    return Object.assign({}, a, { distance_km: m == null ? null : Math.round(m / 100) / 10, distance_m: undefined });
  });
}

// 给列表补 isFav / isBooked
async function decorate(list, openid) {
  if (!openid || !list.length) return (list || []).map(a => Object.assign({}, a, { isFav: false, isBooked: false }));
  const ids = list.map(a => a._id);
  const [favs, bks] = await Promise.all([
    db.collection('favorites').where({ userId: openid, activityId: cmd.in(ids) }).get().catch(() => ({ data: [] })),
    db.collection('bookings').where({ userId: openid, activityId: cmd.in(ids), status: cmd.neq('cancelled') }).get().catch(() => ({ data: [] }))
  ]);
  const fSet = new Set((favs.data || []).map(f => f.activityId));
  const bSet = new Set((bks.data || []).map(b => b.activityId));
  return list.map(a => Object.assign({}, a, { isFav: fSet.has(a._id), isBooked: bSet.has(a._id) }));
}
