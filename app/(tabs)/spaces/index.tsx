import { useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { Colors, Fonts, Spacing, BorderRadius } from '../../../src/constants/theme';

interface Space {
  id: string;
  name: string;
  default_currency: string;
}

export default function SpacesScreen() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSpaces();
  }, []);

  const fetchSpaces = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('workspaces')
      .select('*')
      .or(`owner_id.eq.${user.id},id.in.(${await getMemberWorkspaceIds(user.id)})`);

    setSpaces(data || []);
    setLoading(false);
  };

  const getMemberWorkspaceIds = async (userId: string) => {
    const { data } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .eq('status', 'approved');
    return (data || []).map(m => m.workspace_id).join(',') || '00000000-0000-0000-0000-000000000000';
  };

  const createSpace = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('workspaces')
      .insert({ name: 'New Space', owner_id: user.id, default_currency: 'PHP' })
      .select()
      .single();

    if (data) {
      // Add owner as member
      await supabase.from('workspace_members').insert({
        workspace_id: data.id,
        user_id: user.id,
        role: 'owner',
        status: 'approved',
      });
      // Seed default categories
      await supabase.rpc('seed_default_categories', { p_user_id: user.id, p_workspace_id: data.id });
      setSpaces([...spaces, data]);
    }
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
          <Pressable style={styles.addButton} onPress={createSpace}>
            <Text style={styles.addButtonText}>+ Create Space</Text>
          </Pressable>
        }
      />
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
});
