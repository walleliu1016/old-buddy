// 云函数 pay —— 微信支付结果回调（booking 下单时 functionName 指向本函数）
// 支付成功后：订单置为 paid，写入 transactionId，并触发报名成功订阅消息
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  // 云支付回调 event 结构：{ resultCode, subOpenid, outTradeNo, transactionId, totalFee, ... }
  const outTradeNo = event.outTradeNo || (event.data && event.data.outTradeNo);
  const resultCode = event.resultCode || (event.data && event.data.resultCode);
  if (!outTradeNo) return { errcode: 1, errmsg: 'missing outTradeNo' };
  if (resultCode !== 'SUCCESS') return { errcode: 0, errmsg: 'ignored' };

  const bk = await db.collection('bookings').where({ orderNo: outTradeNo }).get();
  if (!bk.data.length) return { errcode: 1, errmsg: 'order not found' };
  const order = bk.data[0];

  await db.collection('bookings').doc(order._id).update({
    data: {
      status: 'paid', isPaid: true, updatedAt: new Date(),
      payment: { method: 'wechat', transactionId: event.transactionId || '', amount: Number(event.totalFee || order.price), paidAt: new Date() }
    }
  });

  // 报名成功提醒（用户授权过才发得出去，失败不影响支付结果）
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: order.userId,
      templateId: process.env.TPL_BOOKING_REMINDER || '',
      page: 'pages/bookings/bookings', lang: 'zh_CN',
      data: {
        thing1: { value: (order.title || '').slice(0, 20) },
        thing2: { value: (order.venue || '').slice(0, 20) },
        time3: { value: fmt(order.timeText) },
        phrase4: { value: '报名成功' }
      }
    });
  } catch (e) { /* 未授权/无模板时静默 */ }

  return { errcode: 0, errmsg: 'success' };
};

function fmt(t) {
  // 订阅消息 time 类型需 yyyy-MM-dd HH:mm:ss；timeText 多为「周六 14:00」这类文案，退化为开票时间
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
