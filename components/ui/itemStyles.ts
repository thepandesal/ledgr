/**
 * itemStyles.ts
 * Shared styles for split bill items, subitems, people chips, and person selectors.
 * Used in recording-detail, AddItemModal, and any future split-related screens.
 */

import { StyleSheet } from 'react-native';
import { Colors, Fonts, Radius } from './theme';

const itemStyles = StyleSheet.create({

  // ─── Item card (pill row) ─────────────────────────────────────────────────────
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderRadius: Radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.muted,
  },
  itemNumber: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.cyan, width: 18, flexShrink: 0 },
  // number badge (circle) used in AddItemModal
  itemCardNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.cyan, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  itemCardNumText: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.white },
  itemMiddle: { flex: 1, gap: 2 },
  itemName: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.text },
  itemCost: { fontFamily: Fonts.mono, fontSize: 16, color: Colors.muted },
  itemRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  itemDelete: { padding: 4, flexShrink: 0 },
  itemSplit: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted },
  itemsList: { gap: 10, marginBottom: 24 },

  // ─── Item total row ───────────────────────────────────────────────────────────
  itemsTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  itemsTotalLabel: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, flexShrink: 0 },
  itemsTotalDots: {
    flex: 1,
    borderBottomWidth: 1,
    borderStyle: 'dotted',
    borderColor: Colors.faint,
    marginHorizontal: 8,
  },
  itemsTotalValue: { fontFamily: Fonts.monoBold, fontSize: 10, color: Colors.text, flexShrink: 0 },
  allocatedNote: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.income,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },

  // ─── Subitem card ─────────────────────────────────────────────────────────────
  subitemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    marginLeft: 28,
  },
  subitemArrow: { fontSize: 12, color: Colors.faint, flexShrink: 0 },
  subitemName: { fontFamily: Fonts.monoBold, fontSize: 10, color: Colors.text },
  subitemCost: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.text },

  // ─── Add subitem button ───────────────────────────────────────────────────────
  addSubitemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.cyan,
    flexShrink: 0,
  },
  addSubitemBtnText: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.cyan },

  // ─── Person avatar circles ────────────────────────────────────────────────────
  peopleRow: { flexDirection: 'row', gap: 3 },
  personCircle: {
    width: 22, height: 22,
    borderRadius: 11,
    backgroundColor: Colors.cyan,
    justifyContent: 'center',
    alignItems: 'center',
  },
  personCircleExtra: {
    width: 22, height: 22,
    borderRadius: 11,
    backgroundColor: Colors.faint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  personCircleLetter: { fontFamily: Fonts.monoBold, fontSize: 9, color: Colors.white },

  // ─── Person chips (display) ───────────────────────────────────────────────────
  personChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.border,
    borderRadius: Radius.pill,
    paddingVertical: 5,
    paddingLeft: 12,
    paddingRight: 8,
  },
  personChipText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.text },
  personChipDelete: { padding: 2 },
  peopleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  peopleContainer: {
    borderWidth: 1,
    borderColor: Colors.muted,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: 24,
    minHeight: 56,
    justifyContent: 'center',
  },
  peoplePlaceholder: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.faint, textAlign: 'center' },
  peopleHeader: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, textAlign: 'center', marginBottom: 10 },

  // ─── Person select chips (toggle) ────────────────────────────────────────────
  personSelectChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderMid,
    backgroundColor: Colors.surface,
  },
  personSelectChipActive: { backgroundColor: Colors.cyan, borderColor: Colors.cyan },
  personSelectText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  personSelectTextActive: { color: Colors.white, fontFamily: Fonts.monoBold },
  personSelectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: '100%' },

  // ─── Split button grid ────────────────────────────────────────────────────────
  splitBtnGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  splitBtn: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderMid,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
  },
  splitBtnDisabled: { opacity: 0.4 },
  splitBtnText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.text },
});

export default itemStyles;
