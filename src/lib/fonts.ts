/**
 * fonts.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single place to control the app font.
 * To switch fonts, change AppFont values here — no other files need to change.
 *
 * Current font: Google Sans
 * Brand font (LEDGR wordmark): MuseoModerno_Black — never changes
 */

export const AppFont = {
  regular:    'Inter-Regular',
  medium:     'Inter-Medium',
  semiBold:   'Inter-SemiBold',
  bold:       'Inter-Bold',
  brand:      'MuseoModerno_Black',
  brandLight: 'MuseoModerno_Regular',
  brandMedium:'MuseoModerno_Medium',
} as const;
