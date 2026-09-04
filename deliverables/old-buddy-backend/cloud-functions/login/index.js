// 云函数 login —— 微信登录，返回 openid + token
// 部署：微信开发者工具「上传并部署：云端安装依赖」
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const JWT = require('./jwt'); // 自建轻量签名，或用云开发自带 OPENID 透传

exports.main = async (event) => {
  const { OPENID, UNIONID } = cloud.getWXContext();
  if (!OPENID) return { code: 401, msg: '登录失败' };

  const users = db.collection('users');
  const exist = await users.where({ openid: OPENID }).get();
  let isNew = false;
  if (exist.data.length === 0) {
    isNew = true;
    await users.add({
      data: {
        openid: OPENID, unionid: UNIONID || '',
        nickName: '', avatarUrl: '', phone: '',
        city: '', district: '', location: null, radius: 1,
        interests: [], settings: { bigFont: false, voice: false, push: true },
        createdAt: new Date(), lastActiveAt: new Date(), status: 'normal'
      }
    });
  } else {
    await users.where({ openid: OPENID }).update({ data: { lastActiveAt: new Date() } });
  }
  const token = JWT.sign(OPENID);
  const profile = (await users.where({ openid: OPENID }).get()).data[0];
  return { code: 0, data: { openid: OPENID, token, isNew, user: profile } };
};
