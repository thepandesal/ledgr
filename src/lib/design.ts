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

  // Standard modal design (used by all full-screen modals)
  modalBg:          '#ffffff',              // modal background
  modalPadding:     24,                     // horizontal padding inside modal
  modalTitleSize:   22,                     // title font size
  modalBrandSize:   11,                     // LEDGR brand font size
  modalRowBorder:   '#d1d1d1',              // row divider color
  modalRowPadding:  13,                     // row vertical padding
  modalInputBg:     '#F8F8F8',              // value input pill background
  modalInputRadius: 999,                    // value input pill border radius (pill shape)

  // Text input
  inputBg:          '#F8F8F8',              // input background
  inputBorder:      '#d1d1d1',              // input border color
  inputBorderWidth: 1,                      // input border width
  inputRadius:      999,                    // input border radius (pill)
  inputPaddingH:    16,                     // input horizontal padding
  inputPaddingV:    12,                     // input vertical padding
  inputFontSize:    14,                     // input font size
  inputTextColor:   '#111111',              // input text color
  inputPlaceholder: '#c0c0c0',              // placeholder text color

  // Dropdown / selector pill
  dropdownBg:       '#F8F8F8',              // dropdown background
  dropdownRadius:   999,                    // dropdown border radius (pill)
  dropdownPaddingH: 16,                     // dropdown horizontal padding
  dropdownPaddingV: 10,                     // dropdown vertical padding
  dropdownFontSize: 13,                     // dropdown font size
  dropdownTextColor:'#111111',              // dropdown text color
  dropdownMinWidth: 120,                    // minimum width of dropdown pill

  // Toggle (Yes/No pill pair)
  toggleActiveBg:   '#ebf7f6',              // active toggle background
  toggleActiveText: '#4f9289',              // active toggle text
  toggleInactiveBg: '#F8F8F8',              // inactive toggle background
  toggleInactiveText:'#111111',             // inactive toggle text
  toggleRadius:     999,                    // toggle border radius
  togglePaddingH:   16,                     // toggle horizontal padding
  togglePaddingV:   8,                      // toggle vertical padding
  toggleFontSize:   13,                     // toggle font size

  // Form row
  rowLabelSize:     14,                     // row label font size
  rowLabelColor:    '#111111',              // row label color
  rowBorderColor:   '#d1d1d1',              // row bottom border color
  rowPaddingV:      13,                     // row vertical padding
} as const;
