/**
 * design.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for ALL visual design tokens.
 * Change values here — no other files need to be touched.
 *
 * Font:   src/lib/fonts.ts  (separate file for font family control)
 * Colors: below
 */

// ─── Colors ──────────────────────────────────────────────────────────────────

export const DC = {
  // Page
  pageBg:           '#ffffff',
  pageText:         '#111111',
  pageTextMuted:    '#555555',
  pagePadding:      28,         // horizontal padding for all pages

  // Header
  headerBrand:      '#111111',  // LEDGR wordmark color
  headerTitle:      '#111111',  // tab title color
  headerBorder:     '#E6E6E6',

  // Cards
  cardBg:           '#F8F8F8',
  cardBorder:       '#d1d1d1',
  cardBorderWidth:  1,
  cardRadius:       28,
  cardGap:          16,         // margin between cards

  // Card header divider
  cardDividerColor: '#E6E6E6',
  cardDividerWidth: 1.5,

  // Card name
  cardNameColor:    '#111111',

  // Bar
  barDashLeft:      '#CCCCCC',  // dashed line left of dot (faint)
  barDashRight:     '#3d3f3e',  // dashed line right of dot (dark)
  barDashWidth:     12,         // dash segment length
  barDashGap:       3,          // gap between dash segments
  barDashThickness: 3,          // dash height
  barDotSize:       12,         // dot diameter
  barTrackHeight:   20,

  // Status colors
  overBudgetColor:  '#A72F2F',
  overBudgetBorder: '#A72F2F',
  expenseColor:     '#a83333',  // expense amount color
  incomeColor:      '#5dc4bb',  // same as accent1

  // Dot colors
  dotDefault:       '#5dc4bb',  // accent1 — dot color
  dotSavings:       '#5dc4bb',  // accent1 — savings goal met

  // Nav arrows
  navArrowChar:     '‹',        // use as <Text>{DC.navArrowLeft}</Text>
  navArrowLeft:     '‹',
  navArrowRight:    '›',
  navArrowSize:     18,
  navArrowColor:    '#5dc4bb',  // same as accent1

  // Filter row buttons
  filterBg:         '#F8F8F8',
  filterBorder:     '#E6E6E6',
  filterDot:        '#5dc4bb',  // accent1

  // Section headers
  sectionHeaderColor: '#111111',

  // Nav
  navActive:        '#282C2A',
  navInactive:      '#9CA3AF',

  // Accent (chips, active states, save buttons)
  accent:           '#B6E1DE',
  accentText:       '#101514',
  accentDark:       '#2A7A6F',
  accent1:          '#5dc4bb',  // primary accent — arrows, active dots

  // Buttons (non-tab)
  btnBg:            '#ebf7f6',  // background for all non-tab buttons
  btnText:          '#111111',  // button text — always black
  btnBorderWidth:   0,          // no border on buttons

  // Badge active state
  badgeActiveBg:    '#ebf7f6',
  badgeActiveText:  '#4f9289',

  // Activity tab active state
  tabActiveBg:      '#ebf7f6',
  tabActiveText:    '#4f9289',

  // Photo viewer modal
  photoViewerBg:       '#ffffff',
  photoViewerNav:      'rgba(0,0,0,0.08)',  // arrow button background
  photoViewerDeleteBg: '#fff0e4',           // delete button background
  photoViewerDeleteText: '#111111',         // delete button text
} as const;
