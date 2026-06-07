/**
 * pageStyles.ts
 * Shared styles for all detail/screen-level layouts.
 * Used in recording-detail, receipt-detail, space-detail, add-recording, etc.
 */

import { StyleSheet } from 'react-native';
import { Colors, Fonts, Radius, Spacing } from './theme';

const pageStyles = StyleSheet.create({

  // ─── Screen container ────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  inner: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.page, paddingBottom: 60 },

  // ─── Back button ─────────────────────────────────────────────────────────────
  backBtn: { paddingHorizontal: 28, paddingTop: 14, paddingBottom: 4 },

  // ─── Page title block ─────────────────────────────────────────────────────────
  titleBlock: { marginBottom: 16 },
  pageLabel: { fontFamily: Fonts.heading, fontSize: 11, color: Colors.muted, marginBottom: 2, letterSpacing: 0.5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pageName: { fontFamily: Fonts.display, fontSize: 26, color: Colors.text, lineHeight: 30, letterSpacing: -1, flex: 1 },
  pageAmount: { fontFamily: Fonts.mono, fontSize: 20, flexShrink: 0, letterSpacing: 0.2 },

  // ─── Section header ───────────────────────────────────────────────────────────
  sectionHeader: {
    fontFamily: Fonts.heading,
    fontSize: 15,
    color: Colors.cyan,
    letterSpacing: 0.3,
    marginBottom: 10,
    marginTop: 4,
  },

  // ─── Info block (grouped rows) ────────────────────────────────────────────────
  infoBlock: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 24,
  },

  // ─── Action button row ────────────────────────────────────────────────────────
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderMid,
    backgroundColor: Colors.surface,
  },
  actionBtnDanger: {
    borderColor: Colors.dangerBorder,
    backgroundColor: Colors.dangerBg,
  },
  actionBtnSuccess: {
    borderColor: Colors.success,
    backgroundColor: Colors.successBg,
  },
  actionBtnText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.text },

  // ─── Linked nav button (e.g. "view payable →") ───────────────────────────────
  linkedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderMid,
    backgroundColor: Colors.surface,
    marginBottom: 16,
  },
  linkedBtnText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },

  // ─── Toast ────────────────────────────────────────────────────────────────────
  toast: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    backgroundColor: Colors.text,
    borderRadius: Radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toastText: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.white },

  // ─── Tooltip ─────────────────────────────────────────────────────────────────
  tooltip: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
    backgroundColor: Colors.text,
    borderRadius: Radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  tooltipText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.white },

  // ─── Empty state ─────────────────────────────────────────────────────────────
  emptyBox: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderMid,
    backgroundColor: Colors.surface,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, textAlign: 'center' },
});

export default pageStyles;
