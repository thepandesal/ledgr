/**
 * brand.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all visual design tokens in ledgr.
 * Import from here — never hardcode colors, fonts, spacing or sizes anywhere.
 *
 * Usage:
 *   import { Brand } from '@/src/lib/brand';
 *   style={{ color: Brand.color.accent, fontFamily: Brand.font.body }}
 */

// ─── Colors ──────────────────────────────────────────────────────────────────

export const BrandColors = {
  // Header wave
  headerBg:       '#B6E1DE', // wave background (light mint)
  headerText:     '#2D3748', // dark grey on light header bg
  headerTextDim:  '#2D374899', // subtitle/dim text on header
  headerBtnBg:    '#2D374822', // add-button bg on header

  // Accent (buttons, chips, active states)
  accent:         '#B6E1DE', // light mint bg
  accentText:     '#101514', // dark text ON accent bg
  accentDark:     '#2A7A6F', // dark version for text/icons on white bg

  // Navigation
  navActive:      '#282C2A', // active nav icon/label
  navInactive:    '#9CA3AF', // inactive nav icon/label
  bubbleActiveBg: '#EEF2FB', // others bubble active item bg

  // Status
  warning:        '#F97316', // orange — low budget warning
  danger:         '#FFAB91', // soft red — delete/danger
  dangerBg:       '#FFF5F2', // danger button background
  income:         '#B6E1DE', // money in
  expense:        '#FFAB91', // money out (peach)

  // Dark header
  headerDark:     '#1A1A1A', // dark screen header background

  // Neutrals (from theme.ts Colors)
  white:          '#FFFFFF',
  surface:        '#F9FAFB',
  border:         '#F0F0F0',
  borderMid:      '#E8E8E8',
  text:           '#425252',
  muted:          '#929090',
  faint:          '#C0C0C0',
} as const;

// ─── Fonts ───────────────────────────────────────────────────────────────────

export const BrandFonts = {
  display:        'CalSans',              // page titles, space names
  appLabel:       'DMSans_700Bold',       // LEDGR wordmark
  heading:        'DMSans_600SemiBold',   // section headings, card names
  headingBold:    'DMSans_700Bold',       // strong headings
  body:           'DMSans_400Regular',    // body text, nav labels, subtitles
  mono:           'DMSans_400Regular',    // amounts, dates, metadata
  monoBold:       'DMSans_600SemiBold',   // bold amounts, labels
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────

export const BrandType = {
  // Page / wave header
  pageTitle:    { fontFamily: BrandFonts.display,   fontSize: 32, letterSpacing: -0.5 as number },
  pageSubtitle: { fontFamily: BrandFonts.body,      fontSize: 13 },
  appLabel:     { fontFamily: BrandFonts.appLabel,  fontSize: 20 },

  // Section / group headers (e.g. "expense trackers", "Today")
  sectionHeader: {
    fontFamily:    BrandFonts.heading,
    fontSize:      11,
    letterSpacing: 0.6 as number,
    textTransform: 'uppercase' as const,
    color:         BrandColors.muted,
  },

  // Card / list item
  cardTitle:    { fontFamily: BrandFonts.heading,  fontSize: 14, color: BrandColors.text },
  cardMeta:     { fontFamily: BrandFonts.mono,     fontSize: 10, color: BrandColors.muted },
  cardAmount:   { fontFamily: BrandFonts.monoBold, fontSize: 12, letterSpacing: -0.2 as number },
  cardLabel:    { fontFamily: BrandFonts.mono,     fontSize: 10, color: BrandColors.muted, letterSpacing: 0.3 as number },

  // Navigation
  navLabel:     { fontFamily: BrandFonts.body,    fontSize: 10, letterSpacing: 0.4 as number },
  navLabelActive: { fontFamily: BrandFonts.heading, fontSize: 10 },

  // Modal / form
  modalLabel:   {
    fontFamily:    BrandFonts.monoBold,
    fontSize:      11,
    letterSpacing: 0.4 as number,
    textTransform: 'uppercase' as const,
    color:         BrandColors.muted,
  },
  modalInput:   { fontFamily: BrandFonts.monoBold, fontSize: 15, color: BrandColors.text },
  modalBtn:     { fontFamily: BrandFonts.monoBold, fontSize: 14, color: BrandColors.accentText },

  // Footer
  footer:       { fontFamily: BrandFonts.mono, fontSize: 10, color: BrandColors.faint, textAlign: 'center' as const },

  // Empty state
  emptyText:    { fontFamily: BrandFonts.mono, fontSize: 13, color: BrandColors.muted },
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────

export const BrandSpacing = {
  page: 25,
  card:   14,  // card vertical padding
  gap:    12,  // gap between list items
  section: 20, // margin above section headers
} as const;

// ─── Shape ───────────────────────────────────────────────────────────────────

export const BrandRadius = {
  card:   12,  // card border radius
  btn:    999, // pill buttons
  chip:   999, // chips
  input:  14,  // text inputs
  avatar: 999, // circular avatars
  badge:  6,   // small badges
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────

export const BrandShadow = {
  card: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius:  6,
    elevation:     2,
  },
} as const;

// ─── Convenience export ───────────────────────────────────────────────────────

export const Brand = {
  color:   BrandColors,
  font:    BrandFonts,
  type:    BrandType,
  spacing: BrandSpacing,
  radius:  BrandRadius,
  shadow:  BrandShadow,
} as const;
