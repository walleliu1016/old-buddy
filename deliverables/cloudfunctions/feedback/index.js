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

  // 1) 文本安全（v2：需 openid + scene + version）
  if (comment) {
    try {
      const t = await cloud.openapi.security.msgSecCheck({
        openid: openid, scene: 2, version: 2, content: comment
      });
      if (t && t.result && t.result.suggest && t.result.suggest !== 'pass') {
        return { code: 422, msg: '内容包含敏感信息，未提交' };
      }
    } catch (e) {
      if (e && (e.errCode === 87014 || e.errCode === 11250)) {
        return { code: 422, msg: '内容包含敏感信息，未提交' };
      }
      // 其他异常（如权限未开通）不阻塞主流程
      console.warn('msgSecCheck skipped:', (e && (e.errCode || e.message)) || e);
    }
  }
  // 2) 图片安全：imgSecCheck 只收 Buffer，须先 downloadFile
  for (const f of (images || [])) {
    try {
      const dl = await cloud.downloadFile({ fileID: f });
      await cloud.openapi.security.imgSecCheck({
        media: { contentType: 'image/png', value: dl.fileContent }
      });
    } catch (e) {
      if (e && e.errCode === 87014) {
        return { code: 422, msg: '图片未通过审核，未提交' };
      }
      console.warn('imgSecCheck skipped:', (e && (e.errCode || e.message)) || e);
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
