// old-buddy 后端接口封装
// 注意：演示使用本地地址；生产环境必须替换为「已 HTTPS 备案且在微信公众平台配置为合法域名」的地址。
// 微信开发者工具中可在「详情 → 本地设置」勾选「不校验合法域名」以直连本地址。
// 开发期数据服务地址。
// 真机调试/预览时小程序跑在手机上，127.0.0.1 指向手机自身，必须用 Mac 的局域网 IP。
// 当前 Mac 局域网 IP = 192.168.31.136（换 WiFi/网络后需同步修改此处）。
// 上线时改为你的 HTTPS 合法域名。
const BASE = 'http://192.168.31.136:8788';

// 按定位 + 半径拉取附近活动
function nearby(lat, lng, radius) {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: BASE + '/nearby?lat=' + lat + '&lng=' + lng + '&radius=' + radius,
      method: 'GET',
      success: function (res) { resolve(res.data); },
      fail: function (err) { reject(err); }
    });
  });
}

// 触发实时数据源探测（返回溯源状态：seed / live）
function refreshSource() {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: BASE + '/refresh',
      method: 'GET',
      success: function (r) { resolve(r.data); },
      fail: function (e) { reject(e); }
    });
  });
}

module.exports = { nearby, refreshSource, BASE };
