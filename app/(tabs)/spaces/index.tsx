import { useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList, TextInput, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { Colors, Fonts, Spacing, BorderRadius } from '../../../src/constants/theme';

interface Space {
  id: string;
  name: string;
  default_currency: string;
}

const CURRENCIES = ['PHP', 'USD', 'EUR', 'JPY', 'GBP', 'AUD', 'SGD', 'KRW', 'THB', 'MYR'];

export default function SpacesScreen() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [currency, setCurrency] = useState('PHP');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchSpaces();
  }, []);

  const fetchSpaces = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: owned } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', user.id);

    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('status', 'approved');

    let memberSpaces: Space[] = [];
    if (memberships && memberships.length > 0) {
      const ids = memberships.map(m => m.workspace_id);
      const { data } = await supabase.from('workspaces').select('*').in('id', ids);
      memberSpaces = data || [];
    }

    const all = [...(owned || []), ...memberSpaces];
    const unique = all.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
    setSpaces(unique);
    setLoading(false);
  };

  const createSpace = async () => {
    if (!spaceName.trim()) return;
    setCreating(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }

    const { data, error } = await supabase
      .from('workspaces')
      .insert({ name: spaceName.trim(), owner_id: user.id, default_currency: currency })
      .select()
      .single();

    if (data) {
      await supabase.from('workspace_members').insert({
        workspace_id: data.id,
        user_id: user.id,
        role: 'owner',
        status: 'approved',
      });
      await supabase.rpc('seed_default_categories', { p_user_id: user.id, p_workspace_id: data.id });
      setSpaces([...spaces, data]);
    }

    setSpaceName('');
    setCurrency('PHP');
    setCreating(false);
    setModalVisible(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.pageHeader}>Your Spaces</Text>
      <FlatList
        data={spaces}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Spacing.md }}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/workspace/${item.id}`)}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSub}>{item.default_currency}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏠</Text>
            <Text style={styles.emptyText}>No spaces yet</Text>
            <Text style={styles.emptySub}>Create your first space to get started</Text>
          </View>
        }
        ListFooterComponent={
          <Pressable style={styles.addButton} onPress={() => setModalVisible(true)}>
            <Text style={styles.addButtonText}>+ Create Space</Text>
          </Pressable>
        }
      />

      {/* Create Space Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create a Space</Text>

            <Text style={styles.label}>Space Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Household, Trip to Japan"
              placeholderTextColor={Colors.textMuted}
              value={spaceName}
              onChangeText={setSpaceName}
            />

            <Text style={styles.label}>Default Currency</Text>
            <View style={styles.currencyGrid}>
              {CURRENCIES.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.currencyChip, currency === c && styles.currencyChipActive]}
                  onPress={() => setCurrency(c)}
                >
                  <Text style={[styles.currencyText, currency === c && styles.currencyTextActive]}>
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.createButton, (!spaceName.trim() || creating) && { opacity: 0.5 }]}
                onPress={createSpace}
                disabled={!spaceName.trim() || creating}
              >
                <Text style={styles.createButtonText}>
                  {creating ? 'Creating...' : 'Create'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  pageHeader: {
    fontFamily: Fonts.header,
    fontSize: 24,
    color: Colors.text,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontFamily: Fonts.bodySemiBold, fontSize: 16, color: Colors.text },
  cardSub: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontFamily: Fonts.bodySemiBold, fontSize: 16, color: Colors.text, marginTop: Spacing.sm },
  emptySub: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  addButtonText: { fontFamily: Fonts.bodySemiBold, fontSize: 15, color: Colors.white },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  modalTitle: { fontFamily: Fonts.header, fontSize: 22, color: Colors.text, marginBottom: Spacing.lg },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 13,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  input: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  currencyChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currencyChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  currencyText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.text },
  currencyTextActive: { color: Colors.white },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  cancelButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  cancelButtonText: { fontFamily: Fonts.bodySemiBold, fontSize: 15, color: Colors.text },
  createButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  createButtonText: { fontFamily: Fonts.bodySemiBold, fontSize: 15, color: Colors.white },
});
