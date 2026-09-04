// services/storage.js — 本地持久化（收藏 / 设置 / 定位 / 半径 / 报名）
const K_FAV = "ob_fav";
const K_SET = "ob_set";
const K_LOC = "ob_loc";
const K_RAD = "ob_rad";
const K_BK = "ob_bk";

function get(k, def) {
  try { const v = wx.getStorageSync(k); return v ? v : def; } catch (e) { return def; }
}
function set(k, v) { try { wx.setStorageSync(k, v); } catch (e) {} }

module.exports = {
  getFavorites: () => get(K_FAV, []),
  isFavorite: (id) => get(K_FAV, []).some((f) => f.id === id),
  toggleFavorite(item) {
    const list = get(K_FAV, []);
    const i = list.findIndex((f) => f.id === item.id);
    let nowFav;
    if (i >= 0) { list.splice(i, 1); nowFav = false; }
    else { list.unshift(item); nowFav = true; }
    set(K_FAV, list);
    return nowFav;
  },
  getSettings: () => get(K_SET, null),
  saveSettings: (s) => set(K_SET, s),
  getLocation: () => get(K_LOC, null),
  saveLocation: (l) => set(K_LOC, l),
  getRadius: () => get(K_RAD, null),
  saveRadius: (r) => set(K_RAD, r),

  /* ---- 报名（订单） ---- */
  getBookings: () => get(K_BK, []),
  saveBookings: (list) => set(K_BK, list)
};
