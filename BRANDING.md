# LEDGR — Branding & Design Guide

This is the single reference for all visual decisions in the app.
When building or fixing any screen, check here first.

---

## Color Palette

### Brand (Mint / Teal)
| Token | Value | Used for |
|---|---|---|
| `Brand.color.accent` | `#B6E1DE` | Chip backgrounds, active state fills, save button bg |
| `Brand.color.accentDark` | `#2A7A6F` | Text/icons on white when teal accent is needed |
| `Brand.color.accentText` | `#101514` | Dark text placed ON top of `#B6E1DE` bg |

### Primary Accent (Blue)
| Token | Value | Used for |
|---|---|---|
| `DC.headerBlueBg` / `DC.viewBtnText` | `#4394ff` | TopHeader `variant="blue"` bg, active button/link color, active state bg |
| `DC.viewBtnBg` | `#deecff` | Default pill bg for buttons, filter chips, view buttons |

> `#4394ff` is the primary interactive accent color.
> - **Default state:** `#deecff` bg + `#4394ff` text
> - **Active / pressed state:** `#4394ff` bg + white text
> - Used in: TopHeader blue variant, pill buttons, filter chips, view buttons, active links
> - Does NOT bleed into card fills, body text, or passive dividers.

### Neutrals
| Token | Value | Used for |
|---|---|---|
| `DC.pageText` / `Colors.text` | `#111111` / `#425252` | Body text |
| `DC.pageTextMuted` | `#555555` | Secondary/muted text |
| `Colors.muted` | `#929090` | Labels, placeholders, subtitles |
| `Colors.faint` | `#c0c0c0` | Placeholder text in inputs |
| `DC.pageBg` / `Colors.white` | `#ffffff` | Page background |
| `Colors.surface` | `#fafafa` | Card/input backgrounds |
| `DC.cardBg` | `#F8F8F8` | Card fill |

### Borders & Dividers
| Token | Value | Used for |
|---|---|---|
| `DC.controlBorder` | `#d2d2d2` | All pill/input/button borders |
| `DC.cardDividerColor` | `#E6E6E6` | Section dividers inside cards |
| `DC.rowDivider` | `0.5px #f0f0f0` | Row separators in lists |
| `Colors.border` | `#f0f0f0` | Light row borders |
| `Colors.borderMid` | `#e8e8e8` | Medium borders (inputs, cards) |

### Semantic
| Token | Value | Used for |
|---|---|---|
| `Colors.expense` | `#ed6a6a` | Expense amounts, danger text |
| `Colors.income` / `Brand.color.income` | `#2ab671` / `#B6E1DE` | Income amounts |
| `DC.btnDangerBg` | `#FF5757` | Delete/danger buttons |
| `Colors.paid` | `#80b0dd` | Paid status badges |

### What is NOT in the theme
- **Purple (`#8c52ff`)** — leftover in `DC.circleBtn.active`, `DC.button.active`, `DC.segment.active`, and `DC.circleBtn.ghost` (`#f0ebff`). These should all be replaced with `#4394ff` (active bg) or `#deecff` (ghost/default bg). Do not use purple anywhere in the app.

---

## Typography

All text uses **Poppins**. MuseoModerno is only for the app logo/brand label.

| Role | Font | Size | Color |
|---|---|---|---|
| Page title (modal headers) | `Poppins-Bold` | 20px | `#373737` |
| Section header | `Poppins-Bold` | 11px | `#373737` |
| Body / row name | `Poppins-Regular` | 11–14px | `#373737` / `#111111` |
| Sub-content / meta | `Poppins-Regular` | 9–11px | `#555555` |
| Muted label | `Poppins-Regular` | 11px | `#aaaaaa` |
| Amount | `Poppins-Bold` | 11–15px | varies by type |
| Button text | `Poppins-SemiBold` | 13–14px | white or `#101514` |
| Input text | `Poppins-Regular` | 11px | `#373737` |
| TopHeader title (blue) | `Poppins-Bold` | 16px | `#ffffff` |

---

## Components

### TopHeader
The top bar used on all detail/panel screens.

```
variant="blue"   → #4394ff bg, white text, rounded bottom corners (32px)
variant="panel"  → #deecff bg, dark text, rounded bottom corners (32px)
variant="branded"→ #deecff bg, dark text, rounded bottom corners (40px)
variant="default"→ white bg, dark text, 1px bottom border #E6E6E6
```

- Back arrow: 14×14, white on blue / `#666666` on default
- Title: centered when `centered={true}`, `Poppins-Bold` 16px on colored variants
- Right slot: icon button (notifications, ellipsis, etc.)

### Buttons

**Primary save button** (bottom of modals/forms)
- bg: `Brand.color.accent` (`#B6E1DE`)
- text: `Poppins-SemiBold` 13–14px, `Brand.color.accentText` (`#101514`)
- shape: `borderRadius: 999` (pill), `paddingVertical: 14`

**Dark save button** (split bill detail "done" buttons)
- bg: `DC.btnBg` (`#111111`)
- text: white, `Poppins-SemiBold` 13px
- shape: pill

**Danger button**
- bg: `#FF5757` or `Colors.expense + '22'` (tinted)
- text: `#FF5757` or white

**Filter / pill button** (recordings panel, bill-split tab)
- default: bg `DC.viewBtnBg` (`#deecff`), text `#4394ff`, `border: 1px #d2d2d2`, `borderRadius: 999`, height 38
- active: bg `#4394ff`, border `#4394ff`, text white

**View button** (home panel section headers)
- bg: `DC.viewBtnBg` (`#deecff`)
- text: `DC.viewBtnText` (`#4394ff`), `Poppins-Regular` 11px
- shape: pill, `paddingHorizontal: 16`, `paddingVertical: 7`

**Add circle button** (section headers, top right of panels)
- size: 38×38 (standard) or 28×28 (small `ghostSm`)
- default: bg `DC.viewBtnBg` (`#deecff`), icon `#4394ff`
- active / in blue header context: bg `#4394ff`, icon white

**Segment toggle** (Date / Category)
- wrap: `border: 1px #d2d2d2`, `borderRadius: 999`, height 38
- active pill: `#4394ff`
- text inactive: `Poppins-Regular` 11px `#373737`
- text active: `Poppins-SemiBold` 11px white

### Inputs / Search

```
height: 38
borderRadius: 999  (pill)
borderWidth: 1
borderColor: #d2d2d2
paddingHorizontal: 16
fontSize: 11
color: #373737
placeholderTextColor: #c0c0c0
```

### Cards / Rows

**List row** (recordings panel, home panel loans/split bills)
- no card background — rows sit directly on white
- divider: `0.5px #f0f0f0` between rows
- `paddingVertical: 12–14`
- last row has `borderBottomWidth: 0`

**Dotted card** (split bill items)
- `borderWidth: 1.5`, `borderStyle: 'dashed'`, `borderColor: #aaaaaa`
- `borderRadius: 10`, `paddingHorizontal: 14`

**Status badge** (bill-split tab)
- ongoing: bg `Brand.color.accent` (`#B6E1DE`), text `Brand.color.accentDark` (`#2A7A6F`)
- closed: bg `Colors.surface` (`#fafafa`), text `Colors.muted`

### Avatars / Circles

**Person avatar** (home loans, split bill payments)
- size: 44×44 (home) / 36×36 (split bill)
- bg: `DC.viewBtnBg` (`#deecff`) on home, `DC.pageActionBg` (`#ebf7f6`) on split bill
- text: `DC.viewBtnText` (`#4394ff`) on home, `DC.accentDark` (`#2A7A6F`) on split bill

**Step indicator** (split bill wizard)
- inactive: `border: 1px #d2d2d2`, white bg
- active: `DC.accentDark` (`#2A7A6F`) fill + border
- dash done: `DC.accentDark`

### Bottom Sheet / Modal

- bg: white
- title: `Poppins-Bold` or `Poppins-SemiBold`, `#111111`
- row divider: `1px #f0f0f0`
- action rows: `paddingVertical: 16`

---

## Spacing & Layout

| Token | Value |
|---|---|
| `DC.pagePadding` | 34px horizontal page padding |
| `Brand.spacing.page` / `Spacing.page` | 25px (used in some panels) |
| `DC.rowPaddingV` | 13px row vertical padding |
| `DC.cardGap` | 16px between cards |
| `Brand.spacing.gap` | 12px between list items |

---

## Border Radius

| Shape | Value |
|---|---|
| Pill (buttons, inputs, chips) | `999` |
| Cards | `12–14px` |
| TopHeader rounded bottom | `32px` (panel/blue), `40px` (branded) |
| Modals / bottom sheets | `20–24px` top corners |
| Small badges | `6px` |

---

## Key Rules

1. **Never use purple (`#8c52ff`) anywhere.** It is a leftover. Replace all instances with `#4394ff` (active state) or `#deecff` (default/ghost state).
2. **`#4394ff` is the primary interactive accent.** Use it for active button backgrounds, active text, and links. Default button state uses `#deecff` bg + `#4394ff` text. Do not use it for card fills, body text, or passive dividers.
3. **Mint (`#B6E1DE`) is for fills/backgrounds.** Use `accentDark` (`#2A7A6F`) when you need the teal color on text or icons against a white background.
4. **All borders use `#d2d2d2`** for interactive elements (inputs, buttons, pills). Use `#f0f0f0` / `#e8e8e8` for passive dividers.
5. **Font is always Poppins.** MuseoModerno is only for the LEDGR wordmark.
6. **Page background is always white.** Surface (`#fafafa`) is for input fills and card backgrounds only.
