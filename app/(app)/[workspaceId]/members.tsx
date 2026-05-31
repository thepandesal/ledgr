import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import { fetchMembers, approveMember, rejectMember, removeMember, updateMemberRole } from '@/services/db';
import { useAuth } from '@/hooks/useAuth';

export default function MembersScreen() {
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  const { session } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!workspaceId) return;
    fetchMembers(workspaceId).then(setMembers).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [workspaceId]);

  const pending = members.filter((m) => m.status === 'pending');
  const approved = members.filter((m) => m.status === 'approved');

  const handleApprove = async (id: string) => { await approveMember(id); load(); };
  const handleReject = async (id: string) => { await rejectMember(id); load(); };
  const handleRemove = (id: string) => {
    Alert.alert('Remove Member', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await removeMember(id); load(); } },
    ]);
  };

  const MemberRow = ({ item, isPending }: { item: any; isPending?: boolean }) => {
    const profile = item.profiles;
    const initial = (profile?.display_name ?? profile?.email ?? '?')[0].toUpperCase();
    return (
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.memberName}>{profile?.display_name ?? profile?.email ?? 'Unknown'}</Text>
          <Text style={styles.role}>{isPending ? 'Pending approval' : item.role}</Text>
        </View>
        {isPending ? (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item.id)}>
              <Ionicons name="checkmark" size={16} color={Colors.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item.id)}>
              <Ionicons name="close" size={16} color={Colors.white} />
            </TouchableOpacity>
          </View>
        ) : item.user_id !== session?.user?.id ? (
          <TouchableOpacity onPress={() => handleRemove(item.id)}>
            <Ionicons name="trash-outline" size={18} color={Colors.error} />
          </TouchableOpacity>
        ) : (
          <Text style={styles.youLabel}>You</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={[...pending.map((m) => ({ ...m, _pending: true })), ...approved]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            pending.length > 0 ? <Text style={styles.sectionLabel}>Pending ({pending.length})</Text> : null
          }
          renderItem={({ item }) => <MemberRow item={item} isPending={item._pending} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyTitle}>No members yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.lg, paddingBottom: 40 },
  sectionLabel: { fontFamily: Fonts.bodySemiBold, fontSize: 12, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  avatarText: { color: Colors.white, fontFamily: Fonts.bodyBold, fontWeight: '700', fontSize: 15 },
  info: { flex: 1 },
  memberName: { fontFamily: Fonts.bodySemiBold, fontSize: 14, color: Colors.text, fontWeight: '600' },
  role: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  actions: { flexDirection: 'row', gap: Spacing.xs },
  approveBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  rejectBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.error, justifyContent: 'center', alignItems: 'center' },
  youLabel: { fontFamily: Fonts.body, fontSize: 12, color: Colors.primary },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyTitle: { fontFamily: Fonts.bodySemiBold, fontSize: 18, color: Colors.text, fontWeight: '600' },
});
