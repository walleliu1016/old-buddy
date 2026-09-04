// 云函数 user —— 个人资料读写 / 手机号解密 / 订阅模板记录
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxCtx = cloud.getWXContext();
  const openid = wxCtx.OPENID || event.openid;
  if (!openid) return { code: 401, msg: '未登录' };
  if (event.action === 'get') return get(openid);
  if (event.action === 'update') return update(event, openid);
  if (event.action === 'phone') return phone(event, openid);
  return { code: 422, msg: 'unknown action' };
};

async function get(openid) {
  const u = await db.collection('users').where({ openid }).get();
  if (!u.data.length) return { code: 404, msg: '用户不存在' };
  const me = u.data[0];
  const [bk, fav, pend] = await Promise.all([
    db.collection('bookings').where({ userId: openid }).count(),
    db.collection('favorites').where({ userId: openid }).count(),
    db.collection('bookings').where({ userId: openid, status: 'pending' }).count()
  ]);
  return { code: 0, data: {
    openid, nickName: me.nickName || '', avatarUrl: me.avatarUrl || '',
    phone: me.phone ? me.phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : '',
    district: me.district || '', radius: typeof me.radius === 'number' ? me.radius : 1,
    location: me.location || null,
    settings: Object.assign({ bigFont: false, voice: false, push: true }, me.settings || {}),
    counts: { bookings: bk.total, favorites: fav.total, pending: pend.total }
  } };
}

async function update(e, openid) {
  const patch = { lastActiveAt: new Date() };
  ['nickName', 'avatarUrl', 'radius', 'location', 'district', 'city'].forEach(k => {
    if (e[k] !== undefined) patch[k] = e[k];
  });
  if (e.settings) {
    const cur = (await db.collection('users').where({ openid }).get()).data[0] || {};
    patch.settings = Object.assign({ bigFont: false, voice: false, push: true }, cur.settings || {}, e.settings);
  }
  await db.collection('users').where({ openid }).update({ data: patch });
  return { code: 0, data: patch };
}

// 手机号：云开发可用 cloudID 直接换明文
async function phone(e, openid) {
  let purePhoneNumber = '';
  if (e.cloudID) {
    try {
      const res = await cloud.getOpenData({ list: [e.cloudID] });
      purePhoneNumber = (res.list || [])[0] && (res.list[0]).data.phoneNumber || '';
    } catch (err) {
      return { code: 500, msg: '手机号解析失败：' + (err.message || err) };
    }
  } else {
    return { code: 422, msg: '缺少 cloudID（请用 open-type="getPhoneNumber" 获取）' };
  }
  await db.collection('users').where({ openid }).update({ data: { phone: purePhoneNumber } });
  return { code: 0, data: { phone: purePhoneNumber } };
}
