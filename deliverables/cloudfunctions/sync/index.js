// 云函数 sync —— 从「自有数据工厂」拉取聚合结果，幂等 upsert 进云数据库
// 触发方式：① 定时触发器（见 config.json）② 被 activities 云函数空库自愈调用 ③ 手动 callFunction
//
// 环境变量（数据工厂接入方式二选一）：
//   FACTORY_SERVICE  数据工厂的「微信云托管」服务名（推荐：内网 callContainer，免公网/免备案/免鉴权 IP）
//   FACTORY_BASE     数据工厂公网地址，如 https://factory.example.com（自建服务器时用）
//   ADMIN_KEY        数据工厂 admin key（仅 FACTORY_BASE 模式需要）
//
// 两者都未配置时自动使用内置种子数据落库，保证首次部署即可跑通。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const cmd = db.command;
const https = require('https');

const FACTORY_SERVICE = process.env.FACTORY_SERVICE || '';
const FACTORY_BASE = process.env.FACTORY_BASE || '';
const ADMIN_KEY = process.env.ADMIN_KEY || '';

// 统一取数：优先云托管内网 callContainer，其次公网 HTTPS
async function fetchFactory(path) {
  if (FACTORY_SERVICE) {
    const res = await cloud.callContainer({ path: path, method: 'GET' });
    if (res && res.statusCode === 200) return JSON.stringify(res.data);
    throw new Error('callContainer statusCode=' + (res && res.statusCode));
  }
  if (FACTORY_BASE) return httpGet(FACTORY_BASE + path);
  throw new Error('未配置数据工厂（FACTORY_SERVICE / FACTORY_BASE）');
}

exports.main = async (event) => {
  event = event || {};
  const t0 = Date.now();
  const limit = Number(event.limit || 200);

  let records = [], source = 'seed';
  // 1) 优先拉数据工厂
  try {
    const r = await fetchFactory(`/api/v1/activities?limit=${limit}`);
    const body = JSON.parse(r);
    if (body && body.code === 0 && Array.isArray(body.data && body.data.list) && body.data.list.length) {
      records = body.data.list;
      source = FACTORY_SERVICE ? 'factory-cloudrun' : 'factory';
    }
  } catch (e) {
    // 拉失败：记录但不中断，走种子兜底
    console.warn('factory pull failed:', e.message);
  }
  if (!records.length) records = SEED();

  // 2) 幂等 upsert（按 extId 去重）
  let inserted = 0, updated = 0;
  for (const r of records) {
    const extId = r.extId || `${r.title}|${r.venue}|${r.timeText}`;
    const doc = normalize(r, extId);
    const old = await db.collection('activities').where({ extId: extId }).get().catch(() => ({ data: [] }));
    if (old.data && old.data.length) {
      await db.collection('activities').doc(old.data[0]._id).update({ data: doc });
      updated++;
    } else {
      await db.collection('activities').add({ data: Object.assign({ extId }, doc) });
      inserted++;
    }
  }

  // 3) AI 汇总（拉得到就写 ai_summaries）
  let summary = null;
  try {
    const s = JSON.parse(await fetchFactory('/api/v1/summary?scope=city&scopeKey=上海&period=week'));
    if (s && s.code === 0 && s.data && s.data.content) {
      summary = s.data;
      await db.collection('ai_summaries').add({ data: Object.assign({}, summary, { generatedAt: new Date() }) });
    }
  } catch (e) { /* 汇总失败不影响主流程 */ }

  // 4) 写同步日志
  const durationMs = Date.now() - t0;
  await db.collection('sync_logs').add({
    data: { source, lastSyncAt: new Date(), status: 'success',
      fetched: records.length, inserted, updated, durationMs }
  }).catch(() => {});

  return { code: 0, data: { source, fetched: records.length, inserted, updated, durationMs, hasSummary: !!summary } };
};

// 统一活动文档（与 DESIGN.md 数据模型对齐）
function normalize(r, extId) {
  const lat = Number(r.lat), lng = Number(r.lng);
  const hasGeo = isFinite(lat) && isFinite(lng);
  return {
    kind: r.kind === 'course' ? 'course' : 'once',
    title: r.title || '未命名活动',
    category: r.category || '公益',
    venue: r.venue || '', address: r.address || '',
    location: hasGeo ? db.Geo.Point(lng, lat) : null,
    timeText: r.timeText || '待定',
    fee: r.fee || '免费', price: Number(r.price || 0),
    signupType: r.signupType || 'onsite', signupUrl: r.signupUrl || '',
    description: r.description || '', images: r.images || [],
    organizer: r.organizer || '', contact: r.contact || '',
    district: r.district || '',
    capacity: Number(r.capacity || 0), enrolledCount: Number(r.enrolledCount || 0),
    status: 'active',
    source: r.source || 'factory', geoSource: r.geoSource || 'cache',
    aiTags: r.aiTags || [],
    viewCount: 0, favCount: 0, bookingCount: 0,
    // 课程专属
    weeks: r.weeks || '', schedule: r.schedule || '', startText: r.startText || '',
    deadline: r.deadline || '', seatsText: r.seatsText || '', semesterFee: r.semesterFee || '',
    level: r.level || '',
    updatedAt: new Date(), syncAt: new Date()
  };
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'X-Admin-Key': ADMIN_KEY }, timeout: 20000 }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => resolve(buf));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// 内置种子（人民广场周边为主，保证首屏 1km 内有内容；接上数据工厂后自动让位）
function SEED() {
  const base = [
    ['市民合唱团招新','文艺','上海音乐厅','上海市黄浦区延安东路523号',31.2250,121.4730,'周三 14:00','免费',0,'once'],
    ['经典歌剧导赏','文艺','上海大剧院','上海市黄浦区人民大道300号',31.2305,121.4735,'周五 19:30','¥80',8000,'once'],
    ['社区太极晨练','运动','南京西路社区文化活动中心','上海市静安区南京西路街道',31.2270,121.4550,'每日 07:00','免费',0,'once'],
    ['外滩故事会','公益','外滩历史纪念馆','上海市黄浦区中山东一路',31.2397,121.4900,'周六 10:00','免费',0,'once'],
    ['上博青铜器专题讲座','学习','上海博物馆','上海市黄浦区人民大道201号',31.2288,121.4755,'周六 14:00','免费',0,'once'],
    ['人民公园戏曲票友会','文艺','人民公园','上海市黄浦区南京西路231号',31.2320,121.4720,'周日 09:30','免费',0,'once'],
    ['南京路老照片展','文艺','黄浦区文化馆','上海市黄浦区南京东路',31.2350,121.4780,'全天','免费',0,'once'],
    ['外滩街道健康义诊','公益','外滩街道社区中心','上海市黄浦区河南中路',31.2370,121.4790,'周三 08:30','免费',0,'once'],
    ['黄浦图书馆读书分享会','学习','黄浦区图书馆','上海市黄浦区福州路',31.2330,121.4810,'周五 14:00','免费',0,'once'],
    ['人民广场交谊舞会','运动','人民广场','上海市黄浦区人民大道',31.2290,121.4760,'每日 19:30','免费',0,'once'],
    ['智能手机使用入门','学习','上海市老年大学','上海市黄浦区西藏中路',31.2300,121.4700,'每周二 09:00-10:30','免费',0,'course'],
    ['国画花鸟班','学习','静安区老年大学','上海市静安区胶州路',31.2260,121.4480,'每周五 09:00-11:00','¥120/学期',12000,'course'],
    ['太极拳初级班','运动','静安公园','上海市静安区南京西路',31.2245,121.4455,'每周六 07:30-08:30','¥80/学期',8000,'course'],
    ['老年合唱基础班','文艺','徐汇区文化馆','上海市徐汇区漕溪北路',31.1880,121.4360,'每周二 14:00-15:30','免费',0,'course'],
    ['手机摄影与修图课','学习','浦东新区老年大学','上海市浦东新区浦东南路',31.2350,121.5300,'每周四 14:00-15:30','¥60/学期',6000,'course'],
    ['中医养生与食疗课','公益','普陀区中心医院','上海市普陀区长寿路',31.2480,121.4000,'每周一 09:00-10:30','免费',0,'course']
  ];
  const courseMeta = {
    '智能手机使用入门': ['8 周','每周二 09:00-10:30','9月15日开课','9月13日截止报名','剩 3 个名额'],
    '国画花鸟班': ['12 周','每周五 09:00-11:00','9月18日开课','9月16日截止报名','剩 7 个名额'],
    '太极拳初级班': ['10 周','每周六 07:30-08:30','9月19日开课','9月17日截止报名','剩 9 个名额'],
    '老年合唱基础班': ['12 周','每周二 14:00-15:30','9月15日开课','9月13日截止报名','剩 15 个名额'],
    '手机摄影与修图课': ['6 周','每周四 14:00-15:30','9月17日开课','9月15日截止报名','剩 5 个名额'],
    '中医养生与食疗课': ['8 周','每周一 09:00-10:30','9月14日开课','9月12日截止报名','剩 6 个名额']
  };
  return base.map(([title, category, venue, address, lat, lng, timeText, fee, price, kind]) => {
    const r = { title, category, venue, address, lat, lng, timeText, fee, price, kind, source: 'seed', geoSource: 'seed' };
    const m = courseMeta[title];
    if (m) { r.weeks = m[0]; r.schedule = m[1]; r.startText = m[2]; r.deadline = m[3]; r.seatsText = m[4]; }
    return r;
  });
}
