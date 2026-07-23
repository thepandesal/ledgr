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
  regular:    'Poppins-Regular',
  medium:     'Poppins-Medium',
  semiBold:   'Poppins-SemiBold',
  bold:       'Poppins-Bold',
  brand:      'MuseoModerno_Black',
  brandLight: 'MuseoModerno_Regular',
  brandMedium:'MuseoModerno_Medium',
} as const;
