// 云函数 booking —— 报名 / 取消 / 签到（免费直建单；收费返回支付参数）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const cmd = db.command;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (event.action === 'create') return create(event, OPENID);
  if (event.action === 'cancel') return cancel(event, OPENID);
  if (event.action === 'checkin') return checkin(event, OPENID);
  if (event.action === 'list') return list(event, OPENID);
  return { code: 422, msg: 'unknown action' };
};

async function create(e, openid) {
  const act = await db.collection('activities').doc(e.activityId).get();
  if (!act.data) return { code: 404, msg: '活动不存在' };
  const a = act.data;

  // 防重复报名
  const dup = await db.collection('bookings').where({
    userId: openid, activityId: a._id, status: cmd.neq('cancelled')
  }).count();
  if (dup.total > 0) return { code: 409, msg: '已报名' };

  const orderNo = 'OB' + Date.now() + Math.floor(Math.random() * 1000);
  const base = {
    orderNo, userId: openid, activityId: a._id, kind: a.kind,
    title: a.title, venue: a.venue, timeText: a.timeText || a.schedule,
    fee: a.fee, price: a.price || 0, bookedAt: new Date(), updatedAt: new Date()
  };

  if (!a.price || a.price === 0) {
    await db.collection('bookings').add({ data: Object.assign(base, { status: 'pending', isPaid: false }) });
    await bump(a._id, 'bookingCount');
    return { code: 0, data: { orderNo, status: 'pending', needPay: false } };
  }
  // 收费：调云支付下单（此处简化为返回标记，真实用 cloud.cloudPay.unifiedOrder）
  const pay = await cloud.cloudPay.unifiedOrder({
    body: a.title, outTradeNo: orderNo, spbillCreateIp: '127.0.0.1',
    subMchId: '你的子商户号', totalFee: a.price, envId: cloud.DYNAMIC_CURRENT_ENV,
    functionName: 'pay_notify'   // 支付结果由 pay_notify 云函数接收
  });
  await db.collection('bookings').add({ data: Object.assign(base, { status: 'paid', isPaid: true, payment: { method: 'wechat', amount: a.price } }) });
  await bump(a._id, 'bookingCount');
  return { code: 0, data: { orderNo, status: 'paid', needPay: true, pay } };
}

async function cancel(e, openid) {
  const b = await db.collection('bookings').where({ _id: e.id, userId: openid }).get();
  if (!b.data.length) return { code: 404 };
  await db.collection('bookings').doc(e.id).update({
    data: { status: 'cancelled', cancelledAt: new Date(), cancelReason: e.reason || '' }
  });
  return { code: 0, data: { status: 'cancelled' } };
}

async function checkin(e, openid) {
  await db.collection('bookings').doc(e.id).update({ data: { status: 'attended', checkinAt: new Date() } });
  return { code: 0, data: { status: 'attended' } };
}

async function list(e, openid) {
  const status = e.status && e.status !== 'all' ? e.status : cmd.neq('__none__');
  const res = await db.collection('bookings').where({ userId: openid, status }).orderBy('bookedAt', 'desc').get();
  return { code: 0, data: { list: res.data } };
}

async function bump(id, field) {
  await db.collection('activities').doc(id).update({ data: { [field]: cmd.inc(1) } });
}
