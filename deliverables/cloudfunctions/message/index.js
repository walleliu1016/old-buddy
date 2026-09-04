// 云函数 message —— 记录订阅授权 + 发送订阅消息
// 模板需在「小程序后台 - 订阅消息」申请，拿到 templateId 后填入 TEMPLATES
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const TEMPLATES = {
  booking_reminder: process.env.TPL_BOOKING_REMINDER || '',   // 报名成功/活动提醒
  activity_update: process.env.TPL_ACTIVITY_UPDATE || ''      // 活动变更通知
};

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID || event.openid;
  if (!openid) return { code: 401, msg: '未登录' };
  if (event.action === 'subscribe') return subscribe(event, openid);
  if (event.action === 'send') return send(event, openid);
  return { code: 422, msg: 'unknown action' };
};

// 记录用户的订阅授权（前端 wx.requestSubscribeMessage 成功后调用）
async function subscribe(e, openid) {
  const { templateId, type } = e;
  if (!templateId) return { code: 422, msg: 'templateId 必填' };
  await db.collection('messages').add({
    data: { userId: openid, type: type || 'booking_reminder', templateId,
      title: '', body: '', payload: {}, sendStatus: 'unsent', sendAt: null, createdAt: new Date() }
  });
  return { code: 0, data: { ok: true } };
}

// 发送订阅消息（一般由定时任务触发：活动前一天提醒）
async function send(e, openid) {
  const tplId = TEMPLATES[e.type] || e.templateId;
  if (!tplId) return { code: 422, msg: '未配置模板 ID' };
  const data = e.data || {};
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: openid, templateId: tplId,
      page: e.page || 'pages/bookings/bookings',
      lang: 'zh_CN', data, miniprogramState: e.state || 'formal'
    });
    await db.collection('messages').add({
      data: { userId: openid, type: e.type || 'booking_reminder', templateId: tplId,
        title: e.title || '', body: JSON.stringify(data), payload: e.payload || {},
        sendStatus: 'sent', sendAt: new Date(), createdAt: new Date() }
    });
    return { code: 0, data: { sent: true } };
  } catch (err) {
    await db.collection('messages').add({
      data: { userId: openid, type: e.type || 'booking_reminder', templateId: tplId,
        title: e.title || '', body: JSON.stringify(data), payload: e.payload || {},
        sendStatus: 'failed', error: err.message || String(err), sendAt: null, createdAt: new Date() }
    }).catch(() => {});
    return { code: 500, msg: '发送失败：' + (err.message || err) };
  }
}
