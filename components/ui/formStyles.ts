/**
 * formStyles.ts
 * Shared StyleSheet for ALL fill-in bottom sheet modals across the app.
 * Design reference: AddItemModal.tsx
 *
 * Rules:
 * - Sheet: white bg, borderTopRadius 24, padding 24, height '90%'
 * - Header: ChillaxMedium sub 11px #929090 + Avenelle title 26px #425252
 * - Inputs: white bg, borderRadius 10, border #e8e8e8, RobotoMono 16px #425252
 * - Section labels: RobotoMono 10px #929090 uppercase
 * - Cancel btn: #f5f5f5 bg, #8a8a8a text
 * - Primary btn: #425252 bg, white text
 * - Both buttons: borderRadius 999, paddingVertical 13, flex 1, RobotoMono_700Bold 13px
 */

import { StyleSheet } from 'react-native';

const formStyles = StyleSheet.create({

  // ─── Sheet container ────────────────────────────────────────────────────────
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 0,
    height: '90%',
  },

  // ─── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerSub: {
    fontFamily: 'ChillaxMedium',
    fontSize: 11,
    color: '#929090',
    letterSpacing: 0.3,
  },
  headerTitle: {
    fontFamily: 'Avenelle',
    fontSize: 26,
    color: '#425252',
    letterSpacing: -0.5,
    lineHeight: 30,
  },

  // ─── Text inputs ─────────────────────────────────────────────────────────────
  /** Standard standalone input (full width) */
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'RobotoMono_400Regular',
    fontSize: 16,
    letterSpacing: 0.2,
    color: '#425252',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  /** Input inside a card / infoBlock row */
  inlineInput: {
    flex: 1,
    fontFamily: 'RobotoMono_400Regular',
    fontSize: 16,
    letterSpacing: 0.2,
    color: '#425252',
    padding: 0,
  },

  // ─── Section label (above a group of inputs) ─────────────────────────────────
  sectionLabel: {
    fontFamily: 'RobotoMono_400Regular',
    fontSize: 10,
    letterSpacing: 0.2,
    color: '#929090',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },

  // ─── Grouped input block (infoBlock style) ────────────────────────────────────
  block: {
    backgroundColor: '#fafafa',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  blockDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  blockLabel: {
    fontFamily: 'RobotoMono_400Regular',
    fontSize: 11,
    letterSpacing: 0.2,
    color: '#929090',
    width: 60,
    flexShrink: 0,
  },

  // ─── Card (item-level container) ─────────────────────────────────────────────
  card: {
    backgroundColor: '#fafafa',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },

  // ─── Person / tag chips ───────────────────────────────────────────────────────
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    backgroundColor: '#ffffff',
  },
  chipActive: {
    backgroundColor: '#0ccfcf',
    borderColor: '#0ccfcf',
  },
  chipText: {
    fontFamily: 'RobotoMono_400Regular',
    fontSize: 12,
    letterSpacing: 0.2,
    color: '#929090',
  },
  chipTextActive: {
    color: '#ffffff',
    fontFamily: 'RobotoMono_700Bold',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },

  // ─── Selector button (picker trigger) ────────────────────────────────────────
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fafafa',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  selectorPlaceholder: {
    fontFamily: 'RobotoMono_400Regular',
    fontSize: 16,
    letterSpacing: 0.2,
    color: '#c0c0c0',
  },
  selectorValue: {
    fontFamily: 'RobotoMono_400Regular',
    fontSize: 16,
    letterSpacing: 0.2,
    color: '#425252',
  },
  selectorSub: {
    fontFamily: 'RobotoMono_400Regular',
    fontSize: 10,
    letterSpacing: 0.2,
    color: '#929090',
    marginTop: 1,
  },

  // ─── Action buttons ───────────────────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 16,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: 'RobotoMono_700Bold',
    fontSize: 13,
    letterSpacing: 0.2,
    color: '#8a8a8a',
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#425252',
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: 'RobotoMono_700Bold',
    fontSize: 13,
    letterSpacing: 0.2,
    color: '#ffffff',
  },
  dangerBtn: {
    flex: 1,
    backgroundColor: '#ed6a6a',
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
  },

  // ─── List items inside picker modals ─────────────────────────────────────────
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  listItemActive: {
    backgroundColor: '#425252',
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  listItemText: {
    fontFamily: 'RobotoMono_400Regular',
    fontSize: 13,
    letterSpacing: 0.2,
    color: '#425252',
    flex: 1,
  },
  listItemTextActive: {
    fontFamily: 'RobotoMono_700Bold',
    color: '#ffffff',
  },
  listItemSub: {
    fontFamily: 'RobotoMono_400Regular',
    fontSize: 10,
    letterSpacing: 0.2,
    color: '#929090',
  },
  listItemSubActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  listEmpty: {
    fontFamily: 'RobotoMono_400Regular',
    fontSize: 12,
    letterSpacing: 0.2,
    color: '#c0c0c0',
    textAlign: 'center',
    paddingVertical: 16,
  },

  // ─── Search input (inside picker modals) ─────────────────────────────────────
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'RobotoMono_400Regular',
    fontSize: 16,
    letterSpacing: 0.2,
    color: '#425252',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    marginBottom: 8,
  },

  // ─── Hint text ────────────────────────────────────────────────────────────────
  hint: {
    fontFamily: 'RobotoMono_400Regular',
    fontSize: 10,
    letterSpacing: 0.2,
    color: '#0ccfcf',
    marginTop: 4,
  },
  hintMuted: {
    fontFamily: 'RobotoMono_400Regular',
    fontSize: 10,
    letterSpacing: 0.2,
    color: '#929090',
  },

  // ─── Error text ───────────────────────────────────────────────────────────────
  errorText: {
    fontFamily: 'RobotoMono_400Regular',
    fontSize: 11,
    letterSpacing: 0.2,
    color: '#ed6a6a',
    marginBottom: 8,
  },
});

export default formStyles;
