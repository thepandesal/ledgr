/**
 * accountStyles.ts
 * Shared styles for account picker rows used in pay, collect, share modals,
 * and any screen that lists/selects bank accounts.
 */

import { StyleSheet } from 'react-native';
import { Colors, Fonts, Radius } from './theme';

const accountStyles = StyleSheet.create({

  // ─── Account option row ───────────────────────────────────────────────────────
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 6,
    backgroundColor: Colors.surface,
  },
  optionActive: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  optionName: { fontFamily: Fonts.heading, fontSize: 13, color: Colors.text },
  optionNameActive: { color: Colors.white },
  optionBank: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  optionBankActive: { color: 'rgba(255,255,255,0.7)' },

  // ─── Share option buttons (link / save as pdf) ────────────────────────────────
  shareRow: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 4 },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  shareBtnText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.cyan },

  // ─── Receipt strip (thumbnail row on recording-detail) ───────────────────────
  receiptStrip: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  receiptStripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  receiptStripLabel: { fontFamily: Fonts.heading, fontSize: 13, color: Colors.cyan },
  receiptUnlink: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.danger },
  receiptThumb: { width: 64, height: 64, borderRadius: Radius.sm, marginRight: 8 },

  // ─── Photo picker buttons (camera / gallery) ──────────────────────────────────
  photoButtons: { flexDirection: 'row', gap: 12, marginVertical: 16 },
  photoBtn: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
  },
  photoBtnText: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.cyan },
});

export default accountStyles;
