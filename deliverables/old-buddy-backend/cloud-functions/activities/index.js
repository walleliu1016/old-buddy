// 云函数 activities —— 附近 / 课程 / 详情（统一入口，按 event.action 分发）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const $ = db.command.aggregate;
const RADII = [1, 3, 5, 10];

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { action } = event;

  if (action === 'nearby') return nearby(event, OPENID);
  if (action === 'courses') return courses(event, OPENID);
  if (action === 'detail') return detail(event, OPENID);
  return { code: 422, msg: 'unknown action' };
};

// GET /activities/nearby  —— 单次活动(once)，按半径+分类+关键词，附多半径统计
async function nearby(e, openid) {
  const { lat, lng, radius = 1, category = 'all', keyword = '', page = 1, pageSize = 20 } = e;
  const where = { kind: 'once', status: 'active' };
  if (category !== 'all') where.category = category;
  if (keyword) where.title = db.RegExp({ regexp: keyword, options: 'i' });

  // 地理索引查询（GeoJSON Point）
  const center = $.geoNear({
    near: db.Geo.Point(lng, lat),
    distanceField: 'distance_km',
    distanceMultiplier: 1, maxDistance: radius * 1000, spherical: true
  });

  const res = await db.collection('activities').aggregate()
    .match(where).append(center).sort({ distance_km: 1 })
    .skip((page - 1) * pageSize).limit(pageSize).end();

  // 多半径统计（吸顶筛选条）
  const stats = {};
  for (const r of RADII) {
    stats[r] = await db.collection('activities')
      .where(Object.assign({}, where, {
        location: db.command.geoWithin({ centerSphere: [[lng, lat], r / 6378.1] })
      })).count();
  }
  const list = await decorate(res.data, openid);
  return { code: 0, data: { count: list.length, radius_km: radius, stats, list } };
}

// GET /courses —— 全城长期课，按距离排序，不受半径
async function courses(e, openid) {
  const { lat, lng, category = 'all', keyword = '', page = 1, pageSize = 20 } = e;
  const where = { kind: 'course', status: 'active' };
  if (category !== 'all') where.category = category;
  if (keyword) where.title = db.RegExp({ regexp: keyword, options: 'i' });

  const res = await db.collection('activities').aggregate()
    .match(where)
    .append($.geoNear({ near: db.Geo.Point(lng, lat), distanceField: 'distance_km', distanceMultiplier: 1, spherical: true }))
    .sort({ distance_km: 1 }).skip((page - 1) * pageSize).limit(pageSize).end();

  return { code: 0, data: { count: res.data.length, list: await decorate(res.data, openid) } };
}

// GET /activities/:id
async function detail(e, openid) {
  const doc = await db.collection('activities').doc(e.id).get();
  if (!doc.data) return { code: 404, msg: '不存在' };
  const d = doc.data;
  const [fav, bk, related] = await Promise.all([
    openid ? db.collection('favorites').where({ userId: openid, activityId: e.id }).count() : { total: 0 },
    openid ? db.collection('bookings').where({ userId: openid, activityId: e.id, status: db.command.neq('cancelled') }).count() : { total: 0 },
    db.collection('activities').where({ organizer: d.organizer, _id: db.command.neq(e.id) }).limit(3).get()
  ]);
  return { code: 0, data: Object.assign({}, d, {
    isFav: fav.total > 0, isBooked: bk.total > 0, related: related.data
  }) };
}

// 给列表项补 isFav/isBooked
async function decorate(list, openid) {
  if (!openid) return list.map(a => Object.assign({}, a, { isFav: false, isBooked: false }));
  const ids = list.map(a => a._id);
  const [favs, bks] = await Promise.all([
    db.collection('favorites').where({ userId: openid, activityId: db.command.in(ids) }).get(),
    db.collection('bookings').where({ userId: openid, activityId: db.command.in(ids), status: db.command.neq('cancelled') }).get()
  ]);
  const fSet = new Set(favs.data.map(f => f.activityId));
  const bSet = new Set(bks.data.map(b => b.activityId));
  return list.map(a => Object.assign({}, a, { isFav: fSet.has(a._id), isBooked: bSet.has(a._id) }));
}
