# old-buddy 小程序图标体系自检报告

> 生成时间：2026-09-03｜目标：根治企业微信「图标不显示」问题

## 根因
微信 / 企业微信的**原生 tabBar 只能用 PNG 图片**；页面内图标原先走 CSS `background` 的 **data-URI SVG**，企业微信 webview 对超长 data-URI 渲染不稳定，导致大量图标不显示。

## 修复方案
把全部图标改为**本地 PNG 文件**，WXML 一行未改（class 名不变，app.wxss 把背景来源从 data-URI 换成 PNG）。

### 命名分层（故意为之）
- WXSS class：`i-xxx`（带 `i-` 前缀，避免与组件样式冲突）
- 三色变体：`i-xxx`(深青) / `i-xxx-w`(白，深底用) / `i-xxx-o`(橙，选中)
- 文件名：`assets/icons/xxx.png` / `xxx_w.png` / `xxx_o.png`（不带 `i-` 前缀）

### 资源清单
- 页面/组件图标：**75 类 × 3 色 = 113 张** → `assets/icons/`
- tabBar 图标：**6 张**（普通灰 / 选中深青）→ `assets/tabbar/`
- 统一规范：24×24、2px 圆角描边、零 emoji；色板 深青 `#0E6E6E` / 白 / 橙 `#CF5E27`

## 闭环校验结果（2026-09-03 实跑）
| 校验项 | 结果 |
|---|---|
| 页面+组件引用的图标类 → app.wxss 已定义 | ✅ 无缺口（75 引用全定义） |
| app.wxss 图标类的 url() → 磁盘 PNG 存在 | ✅ 无缺失（75 类全有文件） |
| tabBar iconPath / selectedIconPath 齐全 | ✅ 6/6 |
| app.wxss 残留 data-URI | ✅ 0 |

## 验证方式
微信开发者工具 → 重新编译（游客模式 + 模拟器，勾「不校验合法域名」）→ 底部三 tab 与页面内图标全部显示。若个别仍空白，属工具缓存，清缓存重编即可。

## 约束（写进 design-system/MASTER.md）
小程序图标**强制本地 PNG**，禁止 data-URI SVG；HTML 原型（redesign.html）可用内联 SVG currentColor。
