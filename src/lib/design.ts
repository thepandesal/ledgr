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
  pagePadding:      34,         // horizontal padding for all pages
  letterSpacing:    0.3,        // subtle letter spacing for all text

  // Header background color (blue — used by home, spaces, recordings panels)
  headerBlueBg:     '#4394ff',
  headerTitle:      '#111111',  // tab title color
  headerBorder:     '#E6E6E6',
  headerPaddingTop:    28,      // padding above content (below inset)
  headerPaddingBottom: 24,      // padding below content
  headerContentHeight: 52,      // fixed content height — matches home panel's two-line greeting

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
  overBudgetColor:  '#FF5757',
  overBudgetBorder: '#FF5757',
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
  btnBg:            '#111111',  // background for all non-tab buttons
  btnText:          '#ffffff',  // button text — always white
  btnBorder:        '#E5E5E5',  // border for all standard buttons
  btnBorderWidth:   0,          // border width for all standard buttons
  btnShadowColor:   '#000000',
  btnShadowOffset:  { width: 0, height: 2 },
  btnShadowOpacity: 0.12,
  btnShadowRadius:  4,
  btnElevation:     3,
  btnDangerBg:      '#FF5757',  // danger button background
  btnDangerText:    '#ffffff',  // danger button text

  // View / section action button (home panel style — light blue pill)
  viewBtnBg:        '#deecff',  // light blue background
  viewBtnText:      '#4394ff',  // blue text
  viewBtnRadius:    999,
  viewBtnPaddingH:  16,
  viewBtnPaddingV:  7,
  viewBtnFontSize:  11,

  // Space cards
  spaceCardBg:          '#ebf7f6',
  spaceCardBgOver:      '#f7f2eb',
  spaceCardRadius:      14,
  spaceCardBorderWidth: 0,
  spaceCardAmountColor: '#111111',
  spaceCardOverColor:   '#ff5757',
  spaceCardDivider:     '#d1d1d1',

  // Page action buttons (filters, new space, etc.)
  pageActionBg:          '#ebf7f6',
  pageActionText:        '#111111',
  pageActionBorderWidth: 0,
  pageActionDotColor:    '#5dc4bb',
  pageActionPaddingH:    14,
  pageActionPaddingV:    10,
  pageActionRadius:      999,

  // Section headers
  sectionLabelColor:  '#111111', // section label text color — always black
  sectionLabelSize:   13,        // section label font size
  sectionLabelWeight: 'bold' as const,

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
  inputFontSize:    16,                     // input font size — must be ≥16 to prevent Safari zoom
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

  // Chips (sub-modal filter/selector chips)
  chipBg:           '#F8F8F8',
  chipBorder:       '#d1d1d1',
  chipActiveBg:     '#ebf7f6',
  chipActiveText:   '#4f9289',
  chipInactiveText: '#555555',
  chipRadius:       999,
  chipPaddingH:     14,
  chipPaddingV:     8,
  chipFontSize:     13,

  // Row
  rowLabelSize:     14,                     // row label font size
  rowLabelColor:    '#111111',              // row label color
  rowBorderColor:   '#d1d1d1',              // row bottom border color
  rowPaddingV:      13,                     // row vertical padding

  // ── Back button (standard across all pages) ────────────────────────────
  // Usage: <TouchableOpacity onPress={handleBack}><SvgXml xml={SVG_BACK} width={14} height={14} color={DC.backBtn.color} /></TouchableOpacity>
  backBtn: {
    color: '#666666',
    width: 14,
    height: 14,
    marginBottom: 12,
  },

  // ── Components ───────────────────────────────────────────────────────────
  // All interactive elements share the same height (controlHeight).
  // Use these on any page for consistent component styling.
  controlHeight: 38,
  controlRadius: 999,
  controlBorder: '#d2d2d2' as string,
  rowDivider: {
    height: 0.5,
    backgroundColor: '#d8d8d8' as string,
  },
  dottedCard: {
    borderWidth: 1.5,
    borderColor: '#aaaaaa' as string,
    borderStyle: 'dashed' as const,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },

  // Two-option segment toggle (Date / Category)
  segment: {
    wrap: {
      flexDirection: 'row' as const,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: '#d2d2d2' as string,
      overflow: 'hidden' as const,
      position: 'relative' as const,
      height: 38,
    },
    active: {
      position: 'absolute' as const,
      top: 2, bottom: 2,
      width: '50%' as any,
      borderRadius: 999,
      backgroundColor: '#4394ff' as string,
    },
    btn: {
      width: 80, height: 38,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      zIndex: 1,
      paddingVertical: 0,
    },
    textInactive: {
      fontFamily: 'Poppins-Regular' as string,
      fontSize: 11,
      lineHeight: 38,
      color: '#373737' as string,
      includeFontPadding: false,
    },
    textActive: {
      fontFamily: 'Poppins-SemiBold' as string,
      fontSize: 11,
      lineHeight: 38,
      color: '#ffffff' as string,
      includeFontPadding: false,
    },
  },

  // Standard pill button (Filters, Generate Statement, etc.)
  button: {
    base: {
      height: 38,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: '#d2d2d2' as string,
      paddingHorizontal: 16,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    active: {
      height: 38,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: '#4394ff' as string,
      paddingHorizontal: 16,
      backgroundColor: '#4394ff' as string,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    textInactive: {
      fontFamily: 'Poppins-Regular' as string,
      fontSize: 11,
      color: '#373737' as string,
      textAlignVertical: 'center' as const,
      includeFontPadding: false,
    },
    textActive: {
      fontFamily: 'Poppins-SemiBold' as string,
      fontSize: 11,
      color: '#ffffff' as string,
      textAlignVertical: 'center' as const,
      includeFontPadding: false,
    },
  },

  // Textbox / search input
  textbox: {
    wrap: {
      height: 38,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: '#d2d2d2' as string,
      paddingHorizontal: 16,
      justifyContent: 'center' as const,
    },
    input: {
      fontFamily: 'Poppins-Regular' as string,
      fontSize: 16,
      color: '#373737' as string,
      paddingVertical: 0,
    },
  },

  // Circle icon button (edit, folder, trash, add, etc.)
  circleBtn: {
    base: {
      width: 38, height: 38,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: '#d2d2d2' as string,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    active: {
      width: 38, height: 38,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: '#4394ff' as string,
      backgroundColor: '#4394ff' as string,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    ghost: {
      width: 38, height: 38,
      borderRadius: 19,
      backgroundColor: '#deecff' as string,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    ghostSm: {
      width: 28, height: 28,
      borderRadius: 14,
      backgroundColor: '#deecff' as string,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    // Smaller add button for section headers
    addSm: {
      width: 28, height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#d2d2d2' as string,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
  },

  // ── Typography ───────────────────────────────────────────────────────────
  typography: {
    sectionHeader: {
      fontFamily: 'Poppins-Bold' as string,
      fontSize:   11,
      color:      '#373737',
      includeFontPadding: false,
    },
    sectionBody: {
      fontFamily: 'Poppins-Regular' as string,
      fontSize:   11,
      color:      '#373737',
      lineHeight: 16,
    },
    subContent: {
      fontFamily: 'Poppins-Regular' as string,
      fontSize:   9,
      color:      '#373737',
      lineHeight: 14,
    },
    label: {
      fontFamily: 'Poppins-Regular' as string,
      fontSize:   11,
      color:      '#373737',
      lineHeight: 16,
    },
    muted: {
      fontFamily: 'Poppins-Regular' as string,
      fontSize:   11,
      color:      '#aaaaaa',
      lineHeight: 16,
    },
    amount: {
      fontFamily: 'Poppins-Bold' as string,
      fontSize:   11,
      color:      '#373737',
      lineHeight: 16,
    },
    goBack: {
      fontFamily: 'Poppins-Regular' as string,
      fontSize:   11,
      color:      '#666666',
    },
    pageTitle: {
      fontFamily: 'Poppins-Bold' as string,
      fontSize:   20,
      color:      '#373737',
    },
  },
};
