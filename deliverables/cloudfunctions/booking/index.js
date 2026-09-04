// 云函数 booking —— 报名 / 列表 / 取消 / 签到
// 免费活动：直接建单 pending；收费活动：调云支付，支付结果由 pay 云函数回调
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const cmd = db.command;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID || event.openid;
  if (!openid) return { code: 401, msg: '未登录' };

  try {
    if (event.action === 'create') return await create(event, openid);
    if (event.action === 'list') return await list(event, openid);
    if (event.action === 'cancel') return await cancel(event, openid);
    if (event.action === 'checkin') return await checkin(event, openid);
    return { code: 422, msg: 'unknown action' };
  } catch (e) {
    return { code: 500, msg: e.message || String(e) };
  }
};

async function create(e, openid) {
  const act = await db.collection('activities').doc(e.activityId).get().catch(() => null);
  if (!act || !act.data) return { code: 404, msg: '活动不存在' };
  const a = act.data;

  // 防重复报名
  const dup = await db.collection('bookings').where({
    userId: openid, activityId: a._id, status: cmd.neq('cancelled')
  }).count();
  if (dup.total > 0) return { code: 409, msg: '您已报过名了' };

  const orderNo = 'OB' + Date.now() + Math.floor(Math.random() * 900 + 100);
  const base = {
    orderNo, userId: openid, activityId: a._id, kind: a.kind || 'once',
    title: a.title, type: a.category || a.type || '', venue: a.venue || '',
    address: a.address || '', lat: a.lat || null, lng: a.lng || null,
    time: a.timeText || a.time || a.schedule || '', schedule: a.schedule || '',
    weeks: a.weeks || '', start: a.start || '',
    fee: a.fee || '免费', price: Number(a.price || 0),
    bookedAt: new Date(), updatedAt: new Date(),
    reminderSent: false, checkinAt: null
  };

  // 免费：直接建单
  if (!a.price || Number(a.price) === 0) {
    await db.collection('bookings').add({ data: Object.assign(base, { status: 'pending', isPaid: false }) });
    await bump(a._id, 1);
    return { code: 0, data: { orderNo, status: 'pending', needPay: false } };
  }

  // 收费：云支付统一下单（子商户号需在云开发控制台配置）
  let pay;
  try {
    pay = await cloud.cloudPay.unifiedOrder({
      body: a.title, outTradeNo: orderNo, spbillCreateIp: '127.0.0.1',
      subMchId: process.env.SUB_MCH_ID, totalFee: Number(a.price),
      envId: cloud.DYNAMIC_CURRENT_ENV, functionName: 'pay'
    });
  } catch (err) {
    return { code: 500, msg: '支付下单失败：' + (err.message || err) };
  }
  await db.collection('bookings').add({
    data: Object.assign(base, { status: 'unpaid', isPaid: false, payment: { method: 'wechat', amount: Number(a.price) } })
  });
  return { code: 0, data: { orderNo, status: 'unpaid', needPay: true, pay } };
}

async function list(e, openid) {
  const status = (!e.status || e.status === 'all') ? cmd.neq('__none__') : e.status;
  const res = await db.collection('bookings')
    .where({ userId: openid, status })
    .orderBy('bookedAt', 'desc').limit(100).get();
  return { code: 0, data: { list: res.data } };
}

async function cancel(e, openid) {
  const b = await db.collection('bookings').where({ _id: e.id, userId: openid }).get();
  if (!b.data.length) return { code: 404, msg: '订单不存在' };
  const doc = b.data[0];
  const paid = doc.status === 'paid' || doc.isPaid;
  await db.collection('bookings').doc(e.id).update({
    data: { status: paid ? 'refunding' : 'cancelled', cancelledAt: new Date(), cancelReason: e.reason || '', updatedAt: new Date() }
  });
  if (!paid) await bump(doc.activityId, -1);
  return { code: 0, data: { status: paid ? 'refunding' : 'cancelled' } };
}

async function checkin(e, openid) {
  const b = await db.collection('bookings').where({ _id: e.id, userId: openid }).get();
  if (!b.data.length) return { code: 404, msg: '订单不存在' };
  await db.collection('bookings').doc(e.id).update({ data: { status: 'attended', checkinAt: new Date(), updatedAt: new Date() } });
  return { code: 0, data: { status: 'attended' } };
}

async function bump(activityId, delta) {
  if (!activityId) return;
  await db.collection('activities').doc(activityId)
    .update({ data: { bookingCount: cmd.inc(delta) } }).catch(() => {});
}
