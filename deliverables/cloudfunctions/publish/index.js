// 云函数 publish —— 用户自助发布兴趣活动
// action: create(发布) / mine(我发布的) / offline(下架)
// 用户发布的活动与数据工厂活动同集合（activities），用 source='user' 区分，
// kind 固定 'once'（兴趣活动按单次场理解），字段结构与 sync 归一化对齐，
// 因此「附近」查询无需任何改动即可把用户发布混入按距离排序。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const CATEGORIES = ['文艺', '学习', '运动', '公益', '市集'];

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID || event.openid;
  if (!openid) return { code: 401, msg: '未登录' };
  try {
    if (event.action === 'create') return await create(event, openid);
    if (event.action === 'mine') return await mine(openid);
    if (event.action === 'offline') return await offline(event, openid);
    return { code: 422, msg: 'unknown action' };
  } catch (e) {
    return { code: 500, msg: e.message || String(e) };
  }
};

/* ---------- 内容安全：不通过则拒发；接口异常时放行并告警（不阻塞主流程） ---------- */
async function secCheck(openid, text) {
  try {
    const r = await cloud.openapi.security.msgSecCheck({
      openid: openid, scene: 2, version: 2, content: text
    });
    if (r && r.result && r.result.suggest && r.result.suggest !== 'pass') {
      return '内容含敏感信息，请修改文字后再发布';
    }
    return null;
  } catch (e) {
    console.warn('msgSecCheck skipped:', (e && (e.errCode || e.message)) || e);
    return null;
  }
}

/* ---------- 发布 ---------- */
async function create(e, openid) {
  const title = String(e.title || '').trim();
  const timeText = String(e.timeText || '').trim();
  const venue = String(e.venue || '').trim();
  const address = String(e.address || '').trim();
  if (title.length < 2) return { code: 422, msg: '活动名称至少 2 个字' };
  if (!timeText) return { code: 422, msg: '请填写活动时间' };
  if (!venue || !address) return { code: 422, msg: '请填写活动地点' };

  const category = CATEGORIES.indexOf(e.category) >= 0 ? e.category : '公益';
  const description = String(e.description || '').trim();
  const contact = String(e.contact || '').trim();

  const blocked = await secCheck(openid, title + ' ' + description);
  if (blocked) return { code: 403, msg: blocked };

  const lat = Number(e.lat), lng = Number(e.lng);
  const hasGeo = isFinite(lat) && isFinite(lng);
  const price = Number(e.price || 0);

  const doc = {
    kind: 'once',
    source: 'user',
    publisherOpenid: openid,
    title: title,
    category: category,
    venue: venue,
    address: address,
    location: hasGeo ? db.Geo.Point(lng, lat) : null,
    lat: hasGeo ? lat : null,
    lng: hasGeo ? lng : null,
    timeText: timeText,
    fee: price > 0 ? ('¥' + price) : '免费',
    price: price,
    capacity: Number(e.capacity || 0),
    signupType: 'onsite',
    description: description,
    contact: contact,
    images: [],
    aiTags: ['邻居发布'],
    district: e.district || '',
    organizer: '邻居发布',
    status: 'active',
    auditStatus: 'pass',
    viewCount: 0, favCount: 0, bookingCount: 0,
    createdAt: new Date(), updatedAt: new Date()
  };

  const res = await db.collection('activities').add({ data: doc });
  return { code: 0, data: { _id: res._id } };
}

/* ---------- 我发布的 ---------- */
async function mine(openid) {
  const res = await db.collection('activities')
    .where({ source: 'user', publisherOpenid: openid })
    .orderBy('createdAt', 'desc').limit(50).get();
  return { code: 0, data: { list: res.data } };
}

/* ---------- 下架（仅发布者本人） ---------- */
async function offline(e, openid) {
  const q = await db.collection('activities').where({
    _id: e.id, source: 'user', publisherOpenid: openid
  }).update({ data: { status: 'offline', updatedAt: new Date() } });
  if (!q.stats || q.stats.updated === 0) return { code: 404, msg: '记录不存在或无权操作' };
  return { code: 0, data: { status: 'offline' } };
}
