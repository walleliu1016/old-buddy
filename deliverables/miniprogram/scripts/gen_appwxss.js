// 生成 miniprogram/app.wxss：设计令牌 + 共享组件样式 + 图标类（背景图 data URI）
const fs = require("fs");
const path = require("path");

const SVGS = {
  compass: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  mapPin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  bookOpen: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  heartPulse: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/><polyline points="3.5 12 8 12 10 9 13 15 15 12 20.5 12"/>',
  bag: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  navigation: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  volume2: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
};

function uri(inner, color) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${inner}</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg).replace(/'/g, "%27");
}

const TEAL = "%230E6E6E";
const WHITE = "%23FFFFFF";
const ORANGE = "%23CF5E27";

let iconCss = "";
for (const k in SVGS) {
  iconCss += `.i-${k}{background-image:url("${uri(SVGS[k], TEAL)}");}\n`;
  iconCss += `.i-${k}-w{background-image:url("${uri(SVGS[k], WHITE)}");}\n`;
  iconCss += `.i-${k}-o{background-image:url("${uri(SVGS[k], ORANGE)}");}\n`;
}

const tokens = `
page {
  --bg:#F4EFE4; --surface:#FFFFFF; --surface-2:#FBF7EF;
  --primary:#0E6E6E; --primary-d:#0A5454; --primary-soft:#E1EEEC;
  --accent:#E8743B; --accent-d:#CF5E27; --accent-soft:#FBE7DA;
  --ink:#1F2A2B; --ink-2:#5B6B6C; --ink-3:#8A9798; --line:#E7DFCF;
  --free:#2E7D5B; --free-soft:#E2F1E9;
  --r-card:20rpx; --r-btn:28rpx; --r-pill:999rpx; --r-box:32rpx;
  --sh:0 8rpx 24rpx rgba(20,45,45,.10);
  background:var(--bg); color:var(--ink);
  font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  font-size:32rpx; line-height:1.5;
}
view,text,button{box-sizing:border-box;}
.big { --fs-body:38rpx; }
`;

const shared = `
/* 图标基类 */
[class^="i-"]{display:inline-block;width:40rpx;height:40rpx;background-repeat:no-repeat;background-position:center;background-size:contain;}
.i-20{width:20rpx;height:20rpx;} .i-22{width:22rpx;height:22rpx;} .i-24{width:24rpx;height:24rpx;}
.i-26{width:26rpx;height:26rpx;} .i-30{width:30rpx;height:30rpx;} .i-38{width:38rpx;height:38rpx;}

/* 标签 / 按钮 / 卡片 等共享 */
.tag{display:inline-flex;align-items:center;gap:6rpx;font-size:24rpx;font-weight:700;padding:8rpx 18rpx;border-radius:var(--r-pill);background:var(--primary-soft);color:var(--primary);}
.fee{display:inline-block;margin-top:8rpx;font-size:24rpx;font-weight:700;padding:6rpx 18rpx;border-radius:var(--r-pill);}
.fee.free{background:var(--free-soft);color:var(--free);} .fee.paid{background:var(--accent-soft);color:var(--accent-d);}
.btn{flex:1;height:96rpx;border-radius:var(--r-btn);border:none;font-size:34rpx;font-weight:700;display:flex;align-items:center;justify-content:center;gap:12rpx;}
.btn.ghost{background:var(--surface);color:var(--primary);border:3rpx solid var(--primary);}
.btn.solid{background:var(--accent);color:#fff;}
`;

const bigRules = `
/* 大字模式：放大关键正文 */
.big .ac-title{font-size:42rpx;}
.big .meta{font-size:34rpx;}
.big .tag{font-size:28rpx;}
.big .cl{font-size:32rpx;}
.big .dtitle{font-size:50rpx;}
.big .rv{font-size:36rpx;}
.big .it{font-size:36rpx;}
.big .rk{font-size:28rpx;}
.big .greet{font-size:60rpx;}
.big .b{font-size:54rpx;}
.big .chip{font-size:34rpx;}
.big .pn{font-size:48rpx;}
`;
const out = tokens + shared + "\n/* ---- 图标 ---- */\n" + iconCss + bigRules;
const file = path.join(__dirname, "..", "app.wxss");
fs.writeFileSync(file, out, "utf8");
console.log("wrote", file, "bytes:", out.length, "icons:", Object.keys(SVGS).length * 3);
