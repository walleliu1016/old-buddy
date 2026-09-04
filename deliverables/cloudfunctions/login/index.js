// 云函数 login —— 微信登录，返回 openid + token（首次自动建号）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const JWT = require('./jwt');

exports.main = async (event) => {
  // 云开发环境下 getWXContext 直接给 openid，无需 code2Session
  const wxCtx = cloud.getWXContext();
  const OPENID = wxCtx.OPENID || (event && event.openid) || '';
  const UNIONID = wxCtx.UNIONID || '';
  if (!OPENID) return { code: 401, msg: '登录失败：未取到 openid' };

  const users = db.collection('users');
  const exist = await users.where({ openid: OPENID }).get();
  let isNew = false;

  if (exist.data.length === 0) {
    isNew = true;
    await users.add({
      data: {
        openid: OPENID,
        unionid: UNIONID || '',
        nickName: (event && event.nickName) || '',
        avatarUrl: (event && event.avatarUrl) || '',
        phone: '',
        city: '', district: '', location: null, radius: 1,
        interests: [],
        settings: { bigFont: false, voice: false, push: true },
        createdAt: new Date(), lastActiveAt: new Date(),
        status: 'normal'
      }
    });
  } else {
    await users.where({ openid: OPENID }).update({ data: { lastActiveAt: new Date() } });
  }

  const profile = (await users.where({ openid: OPENID }).get()).data[0];
  return { code: 0, data: { openid: OPENID, token: JWT.sign(OPENID), isNew, user: profile } };
};
