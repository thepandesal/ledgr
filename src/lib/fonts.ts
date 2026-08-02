/**
 * fonts.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single place to control the app font.
 * To switch fonts, change AppFont values here — no other files need to change.
 *
 * Current font: Poppins
 * Brand font (LEDGR wordmark): MuseoModerno-ExtraBold — never changes
 */

export const AppFont = {
  regular:     'Poppins-Regular',
  medium:      'Poppins-Medium',
  semiBold:    'Poppins-SemiBold',
  bold:        'Poppins-Bold',
  brand:       'MuseoModerno-ExtraBold',
  brandLight:  'MuseoModerno-Regular',
  brandMedium: 'MuseoModerno-Medium',
} as const;
