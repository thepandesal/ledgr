/**
 * formStyles.ts
 * Shared StyleSheet for ALL fill-in bottom sheet modals across the app.
 * Design reference: AddItemModal.tsx
 *
 * Rules:
 * - Sheet: white bg, borderTopRadius 24, padding 24, height '90%'
 * - Header: Poppins-Medium sub 11px #929090 + Poppins-Bold title 26px #425252
 * - Inputs: white bg, borderRadius 10, border #e8e8e8, RobotoMono 16px #425252
 * - Section labels: RobotoMono 10px #929090 uppercase
 * - Cancel btn: #f5f5f5 bg, #8a8a8a text
 * - Primary btn: #425252 bg, white text
 * - Both buttons: borderRadius 999, paddingVertical 13, flex 1, Poppins-Bold 13px
 */

import { StyleSheet } from 'react-native';
import { DC } from '../../src/lib/design';
import { AppFont } from '../../src/lib/fonts';
import { Colors } from './theme';

const formStyles = StyleSheet.create({

  sheet: {
    backgroundColor: DC.modalBg,
    borderTopLeftRadius: DC.cardRadius,
    borderTopRightRadius: DC.cardRadius,
    padding: DC.modalPadding,
    paddingBottom: 0,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerSub: {
    fontFamily: AppFont.medium,
    fontSize: DC.modalBrandSize,
    color: DC.pageTextMuted,
  },
  headerTitle: {
    fontFamily: AppFont.bold,
    fontSize: DC.modalTitleSize,
    color: DC.pageText,
    lineHeight: DC.modalTitleSize + 6,
  },

  input: {
    backgroundColor: DC.inputBg,
    borderRadius: DC.inputRadius,
    paddingHorizontal: DC.inputPaddingH,
    paddingVertical: DC.inputPaddingV,
    fontFamily: AppFont.regular,
    fontSize: DC.inputFontSize,
    color: DC.inputTextColor,
    borderWidth: DC.inputBorderWidth,
    borderColor: DC.inputBorder,
  },
  inlineInput: {
    flex: 1,
    fontFamily: AppFont.regular,
    fontSize: DC.inputFontSize,
    color: DC.inputTextColor,
    padding: 0,
  },

  sectionLabel: {
    fontFamily: AppFont.regular,
    fontSize: 10,
    color: DC.pageTextMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
  },

  block: {
    backgroundColor: DC.cardBg,
    borderRadius: DC.cardRadius / 2,
    paddingHorizontal: DC.modalPadding / 2,
    paddingVertical: 4,
    borderWidth: DC.cardBorderWidth,
    borderColor: DC.cardBorder,
  },
  blockDivider: {
    height: 1,
    backgroundColor: DC.cardBorder,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: DC.modalRowPadding / 2,
    gap: 10,
  },
  blockLabel: {
    fontFamily: AppFont.regular,
    fontSize: 11,
    color: DC.pageTextMuted,
    width: 60,
    flexShrink: 0,
  },

  card: {
    backgroundColor: DC.cardBg,
    borderRadius: DC.cardRadius / 2,
    padding: DC.modalPadding / 2,
    marginBottom: DC.cardGap / 2,
    borderWidth: DC.cardBorderWidth,
    borderColor: DC.cardBorder,
  },

  chip: {
    paddingVertical: 6,
    paddingHorizontal: DC.dropdownPaddingH,
    borderRadius: DC.dropdownRadius,
    borderWidth: DC.cardBorderWidth,
    borderColor: DC.cardBorder,
    backgroundColor: DC.modalBg,
  },
  chipActive: {
    backgroundColor: DC.accent,
    borderColor: DC.accent,
  },
  chipText: {
    fontFamily: AppFont.regular,
    fontSize: 12,
    color: DC.pageTextMuted,
  },
  chipTextActive: {
    color: DC.accentText,
    fontFamily: AppFont.semiBold,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },

  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: DC.dropdownBg,
    borderRadius: DC.dropdownRadius,
    paddingHorizontal: DC.dropdownPaddingH,
    paddingVertical: DC.dropdownPaddingV,
    borderWidth: DC.cardBorderWidth,
    borderColor: DC.cardBorder,
  },
  selectorPlaceholder: {
    fontFamily: AppFont.regular,
    fontSize: DC.dropdownFontSize,
    color: DC.inputPlaceholder,
  },
  selectorValue: {
    fontFamily: AppFont.regular,
    fontSize: DC.dropdownFontSize,
    color: DC.dropdownTextColor,
  },
  selectorSub: {
    fontFamily: AppFont.regular,
    fontSize: 10,
    color: DC.pageTextMuted,
    marginTop: 1,
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: DC.modalRowPadding,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: DC.cardBg,
    borderRadius: DC.dropdownRadius,
    paddingVertical: DC.modalRowPadding - 3,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: AppFont.semiBold,
    fontSize: DC.dropdownFontSize,
    color: DC.pageTextMuted,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: DC.accent1,
    borderRadius: DC.dropdownRadius,
    paddingVertical: DC.modalRowPadding - 3,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: AppFont.semiBold,
    fontSize: DC.dropdownFontSize,
    color: DC.pageBg,
  },
  dangerBtn: {
    flex: 1,
    backgroundColor: Colors.danger,
    borderRadius: DC.dropdownRadius,
    paddingVertical: DC.modalRowPadding - 3,
    alignItems: 'center',
  },

  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: DC.modalRowPadding,
    borderBottomWidth: 1,
    borderBottomColor: DC.cardBorder,
  },
  listItemActive: {
    backgroundColor: DC.accent1,
    borderRadius: DC.cardRadius / 4,
    paddingHorizontal: 10,
  },
  listItemText: {
    fontFamily: AppFont.regular,
    fontSize: DC.dropdownFontSize,
    color: DC.pageText,
    flex: 1,
  },
  listItemTextActive: {
    fontFamily: AppFont.semiBold,
    color: DC.pageBg,
  },
  listItemSub: {
    fontFamily: AppFont.regular,
    fontSize: 10,
    color: DC.pageTextMuted,
  },
  listItemSubActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  listEmpty: {
    fontFamily: AppFont.regular,
    fontSize: 12,
    color: DC.inputPlaceholder,
    textAlign: 'center',
    paddingVertical: 16,
  },

  searchInput: {
    backgroundColor: DC.inputBg,
    borderRadius: DC.inputRadius,
    paddingHorizontal: DC.inputPaddingH,
    paddingVertical: DC.inputPaddingV,
    fontFamily: AppFont.regular,
    fontSize: DC.inputFontSize,
    color: DC.inputTextColor,
    borderWidth: DC.inputBorderWidth,
    borderColor: DC.inputBorder,
    marginBottom: 8,
  },

  hint: {
    fontFamily: AppFont.regular,
    fontSize: 10,
    color: DC.accentDark,
    marginTop: 4,
  },
  hintMuted: {
    fontFamily: AppFont.regular,
    fontSize: 10,
    color: DC.pageTextMuted,
  },

  errorText: {
    fontFamily: AppFont.regular,
    fontSize: 11,
    color: Colors.danger,
    marginBottom: 8,
  },
});

export default formStyles;
