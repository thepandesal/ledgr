import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';

export default function ReceiptsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Receipts</Text>
      </View>
      <View style={styles.empty}>
        <Ionicons name="receipt-outline" size={48} color={Colors.border} />
        <Text style={styles.emptyTitle}>No receipts yet</Text>
        <Text style={styles.emptySubtitle}>Open a workspace to manage receipts</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  title: { fontFamily: Fonts.bodyBold, fontSize: 24, color: Colors.text, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  emptyTitle: { fontFamily: Fonts.bodySemiBold, fontSize: 18, color: Colors.text, fontWeight: '600' },
  emptySubtitle: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted },
});
