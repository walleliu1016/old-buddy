// 云函数 feedback —— 图文反馈，先走内容安全再落库
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { activityId, rating, comment = '', images = [] } = event;

  // 文本安全
  if (comment) {
    const t = await cloud.openapi.security.msgSecCheck({ content: comment }).catch(() => null);
    if (t && t.errCode !== 0 && t.risky) return { code: 422, msg: '含敏感内容，未提交' };
  }
  // 图片安全（逐张）
  for (const f of images) {
    const r = await cloud.openapi.security.imgSecCheck({ media: { mediaFileID: f } }).catch(() => null);
    if (r && r.errCode !== 0 && r.risky) return { code: 422, msg: '含违规图片，未提交' };
  }

  const id = await db.collection('feedbacks').add({
    data: { userId: OPENID, activityId, rating, comment, images,
      secCheckStatus: 'pass', status: 'pending', createdAt: new Date() }
  });
  return { code: 0, data: { id, secCheckStatus: 'pass' } };
};
