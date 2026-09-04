// services/location.js — 定位封装（gcj02）
function getLocation() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: "gcj02",
      success: (res) => resolve({ lat: res.latitude, lng: res.longitude, name: "我的位置" }),
      fail: (err) => reject(err)
    });
  });
}

module.exports = { getLocation };
