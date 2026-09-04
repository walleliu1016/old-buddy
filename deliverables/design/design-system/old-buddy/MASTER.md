# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** old-buddy
**Generated:** 2026-09-02 23:02:37
**Category:** Senior Care/Elderly

---

## Global Rules

### Color Palette

> **OVERRIDE NOTE (2026-09-02):** 自动推荐的原色为 `#7C3AED`（紫）。该色违反本设计系统自身的 Anti-Pattern「AI 紫粉渐变」，且与用户已否决的紫色方向冲突。经比对 color 域检索结果，社区/服务/康养类产品最优配色为「Caring teal + warm orange」，故采用下方夕阳红 + 暖橙体系，已落地于 `webapp/css/styles.css`（2026-09-03 将主色由深青 #0E6E6E 切换为夕阳红 #C8472E）。

| Role | Hex | CSS Variable (实际) | 用途 |
|------|-----|--------------|------|
| Primary（夕阳红） | `#C8472E` | `--c-primary`（实际 `--primary`） | 顶栏、主按钮、激活态、标题强调 |
| Primary-600 | `#9E3320` | `--c-primary-600` | 图标、次级强调 |
| Primary-50（红浅底） | `#F6E3DC` | `--c-primary-50` | 激活/悬停底色、图标圆底 |
| Accent（暖橙行动） | `#EA580C` | `--c-accent` | 报名 CTA、收藏激活、焦点环 |
| Accent-50 | `#FFF7ED` | `--c-accent-50` | 暖橙淡底 |
| Background | `#F4F6F5` | `--c-bg` | 页面底色（暖中性，规避纯白眩光） |
| Surface | `#FFFFFF` | `--c-surface` | 卡片/菜单白底 |
| Text | `#1F2933` | `--c-text` | 正文（白底 7:1 对比） |
| Text-2 | `#475569` | `--c-text-2` | 次要文字（7:1） |
| Text-3 | `#64748B` | `--c-text-3` | 辅助说明（仅非关键） |
| Border | `#E5E9EC` | `--c-border` | 描边 |
| Free（免费绿） | `#047857` | `--c-free` | 「免费」标签 |
| Warn（防骗琥珀） | `#B45309` | `--c-warn` | 防诈骗提示文字 |

**Color Notes:** Sunset red（夕阳红·温暖/归属/老年主题）+ warm orange（行动/温度），高对比、适老友好。

### Typography

- **Heading Font:** Varela Round
- **Body Font:** Nunito Sans
- **Mood:** soft, rounded, friendly, approachable, warm, gentle
- **Google Fonts:** [Varela Round + Nunito Sans](https://fonts.google.com/share?selection.family=Nunito+Sans:wght@300;400;500;600;700|Varela+Round)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;500;600;700&family=Varela+Round&display=swap');
```

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #22C55E;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #7C3AED;
  border: 2px solid #7C3AED;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #FAF5FF;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #7C3AED;
  outline: none;
  box-shadow: 0 0 0 3px #7C3AED20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Accessible & Ethical

**Keywords:** High contrast, large text (16px+), keyboard navigation, screen reader friendly, WCAG compliant, focus state, semantic

**Best For:** Government, healthcare, education, inclusive products, large audience, legal compliance, public

**Key Effects:** Clear focus rings (3-4px), ARIA labels, skip links, responsive design, reduced motion, 44x44px touch targets

### Page Pattern

**Pattern Name:** App Store Style Landing

- **Conversion Strategy:** Show real screenshots. Include ratings (4.5+ stars). QR code for mobile. Platform-specific CTAs.
- **CTA Placement:** Download buttons prominent (App Store + Play Store) throughout
- **Section Order:** 1. Hero with device mockup, 2. Screenshots carousel, 3. Features with icons, 4. Reviews/ratings, 5. Download CTAs

---

## Anti-Patterns (Do NOT Use)

- ❌ Small text
- ❌ Complex navigation
- ❌ AI purple/pink gradients

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis as icons (use SVG: Heroicons/Lucide)
- [ ] cursor-pointer on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard nav
- [ ] prefers-reduced-motion respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile

---

## Icon System（2026-09-03 重做约定）

- **统一线性图标规范**：24×24 视图框，2px 圆角描边（stroke-linecap=round），零 emoji、无渐变填充。
- **小程序（原生 / 企业微信）强制用本地 PNG 图标**，不要用 CSS `background` 的 data-URI SVG：企业微信 webview 对超长 data-URI 渲染不稳，会导致"页面内大量图标不显示"。
  - tabBar 图标：`assets/tabbar/tab_{home,courses,me}{,_on}.png`（81×81，普通灰 #8A9798 / 选中夕阳红 #C8472E）。
  - 页面内图标：`assets/icons/{name}.png`（夕阳红 #C8472E）/`{name}_w.png`（白，用于深底）/`{name}_o.png`（橙 #CF5E27，选中/激活）。类名沿用 `.i-{name}` / `.i-{name}-w` / `.i-{name}-o`，由 `app.wxss` 引用。
  - 重新生成见 `/tmp/gen_icons.py`（PIL 原生绘制）。
- **Web / HTML 原型**用内联 `<svg>` + `currentColor`，随文字色自适应（同套视觉规范）。
- 图源：Lucide 风格线性图标；禁 emoji。
