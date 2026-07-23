/**
 * theme.ts
 * Central design tokens for ledgr.
 * Import from here — never hardcode colors or fonts in component files.
 */

export const Colors = {
  // Brand
  cyan: '#7fd8cd',
  headerBg: '#1A1A1A', // dark screen header background

  // Text
  text: '#425252',
  muted: '#929090',
  faint: '#c0c0c0',

  // Backgrounds
  white: '#ffffff',
  surface: '#fafafa',
  input: '#f5f5f5',

  // Borders
  border: '#f0f0f0',
  borderMid: '#e8e8e8',

  // Semantic
  expense: '#ed6a6a',
  income: '#2ab671',
  danger: '#ed6a6a',
  dangerBg: '#fff8f8',
  dangerBorder: '#fde8e8',
  success: '#2ab671',
  successBg: '#f0fff8',
  warningBg: '#fff8f0',
  warningBorder: '#f0e0c0',
  pending: '#eed68b',
  paid: '#80b0dd',

  // Overlays
  overlay: 'rgba(0,0,0,0.3)',
} as const;

export const Fonts = {
  display:         'Poppins-Bold',
  heading:         'Poppins-SemiBold',
  headingRegular:  'Poppins-Regular',
  headingBold:     'Poppins-Bold',
  headingSemibold: 'Poppins-SemiBold',
  headingLight:    'Poppins-Regular',
  museoBlack:      'MuseoModerno_Black',
  museoMedium:     'MuseoModerno_Medium',
  museoRegular:    'MuseoModerno_Regular',
  calSans:         'Poppins-Bold',
  glacial:         'Poppins-Regular',
  glacialBold:     'Poppins-Bold',
  mono:            'Poppins-Regular',
  monoBold:        'Poppins-Bold',
  sans:            'Poppins-Regular',
  sansMedium:      'Poppins-Medium',
  sansSemiBold:    'Poppins-SemiBold',
  sansBold:        'Poppins-Bold',
} as const;

export const Radius = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  page: 25,
} as const;

export const LetterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.3,
  wider: 0.5,
  widest: 1,
} as const;

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 10,
  },
  hard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 0,
    elevation: 2,
  },
} as const;
