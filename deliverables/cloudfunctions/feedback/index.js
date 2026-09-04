// 云函数 feedback —— 图文反馈，先过内容安全再落库
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID || event.openid;
  if (!openid) return { code: 401, msg: '未登录' };

  const { activityId, rating, comment = '', images = [] } = event;
  if (!comment && (!images || !images.length)) return { code: 422, msg: '请填写内容或上传图片' };

  // 1) 文本安全
  if (comment) {
    const t = await cloud.openapi.security.msgSecCheck({ content: comment }).catch(e => ({ errCode: -1, e }));
    if (t && t.errCode !== 0 && t.errCode !== 87014 && t.risky) {
      return { code: 422, msg: '内容包含敏感信息，未提交' };
    }
  }
  // 2) 图片安全（fileID 直传）
  for (const f of (images || [])) {
    const r = await cloud.openapi.security.imgSecCheck({ media: { mediaFileID: f } }).catch(e => ({ errCode: -1, e }));
    if (r && r.errCode !== 0 && r.errCode !== 87014 && r.risky) {
      return { code: 422, msg: '图片未通过审核，未提交' };
    }
  }

  const add = await db.collection('feedbacks').add({
    data: {
      userId: openid, activityId: activityId || '',
      rating: Number(rating || 0), comment, images: images || [],
      secCheckStatus: 'pass', status: 'pending',
      createdAt: new Date()
    }
  });
  return { code: 0, data: { id: add._id, secCheckStatus: 'pass' } };
};
