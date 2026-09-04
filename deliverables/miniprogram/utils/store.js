// 本地存储：收藏 + 设置（半径偏好、大字模式、语音播报）
const FAV_KEY = 'ob_favorites';
const SET_KEY = 'ob_settings';

function getFavorites() { return wx.getStorageSync(FAV_KEY) || []; }

function isFav(id) {
  return getFavorites().some(function (a) { return a.id === id; });
}

function toggleFav(a) {
  var list = getFavorites();
  var i = -1;
  for (var k = 0; k < list.length; k++) {
    if (list[k].id === a.id) { i = k; break; }
  }
  if (i >= 0) list.splice(i, 1); else list.unshift(a);
  wx.setStorageSync(FAV_KEY, list);
  return i < 0; // true=已收藏，false=已取消
}

function getSettings() { return wx.getStorageSync(SET_KEY) || {}; }
function saveSettings(s) { wx.setStorageSync(SET_KEY, s); }

module.exports = { getFavorites, isFav, toggleFav, getSettings, saveSettings };
