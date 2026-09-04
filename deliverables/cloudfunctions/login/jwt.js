// 轻量 JWT（HMAC-SHA256），仅用于云函数间/openid 透传签名
// 生产建议把 JWT_SECRET 配到云函数环境变量
const crypto = require('crypto');
const SECRET = process.env.JWT_SECRET || 'oldbuddy-dev-secret-change-me';

function b64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sign(openid, expHours = 24 * 30) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    sub: openid,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expHours * 3600
  }));
  const raw = `${header}.${payload}`;
  const sig = crypto.createHmac('sha256', SECRET).update(raw).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${raw}.${sig}`;
}

function verify(token) {
  try {
    const [h, p, s] = String(token || '').split('.');
    if (!h || !p || !s) return null;
    const raw = `${h}.${p}`;
    const expect = crypto.createHmac('sha256', SECRET).update(raw).digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (expect !== s) return null;
    const payload = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

module.exports = { sign, verify };
