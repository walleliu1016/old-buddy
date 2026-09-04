// config.js —— 一处配置，全端生效
//
// 上线三步：
//   1. 微信开发者工具 → 云开发 → 开通，拿到「环境 ID」填到 cloud.env
//   2. cloud.enabled 改 true
//   3. 上传 cloudfunctions/ 下的云函数（右键「上传并部署：云端安装依赖」）
//
// 未开通云开发前保持 enabled:false，小程序会走 legacy 本地数据服务，功能不受影响。
module.exports = {
  cloud: {
    enabled: false,        // ← 开通云开发后改为 true
    env: ''                // ← 填云开发环境 ID，如 'oldbuddy-1x3k9z'
  },

  // 降级用的本地/局域网数据服务（v2 server.py）
  legacy: {
    base: 'http://192.168.31.136:8789'
  },

  // 内容形态常量（与后端 kind 对齐）
  KIND_ONCE: 'once',
  KIND_COURSE: 'course'
};
