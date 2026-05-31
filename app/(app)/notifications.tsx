import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { fetchNotifications, markNotificationRead } from '@/services/db';

const NOTIF_ICONS: Record<string, any> = {
  invite: 'mail-outline',
  split: 'people-outline',
  payment: 'card-outline',
  due_date: 'calendar-outline',
  savings: 'save-outline',
  default: 'notifications-outline',
};

export default function NotificationsScreen() {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!session?.user?.id) return;
    fetchNotifications(session.user.id).then(setNotifications).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [session?.user?.id]);

  const handleRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.card, !item.read && styles.cardUnread]} onPress={() => handleRead(item.id)} activeOpacity={0.7}>
              <View style={[styles.iconWrap, !item.read && styles.iconWrapUnread]}>
                <Ionicons name={NOTIF_ICONS[item.type] ?? NOTIF_ICONS.default} size={18} color={item.read ? Colors.textMuted : Colors.primary} />
              </View>
              <View style={styles.info}>
                <Text style={[styles.message, !item.read && styles.messageUnread]}>{item.message}</Text>
                <Text style={styles.time}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </View>
              {!item.read && <View style={styles.dot} />}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyTitle}>All caught up</Text>
              <Text style={styles.emptySubtitle}>No new notifications</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  title: { fontFamily: Fonts.bodyBold, fontSize: 24, color: Colors.text, fontWeight: '700' },
  list: { padding: Spacing.lg, paddingBottom: 40 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  cardUnread: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  iconWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  iconWrapUnread: { backgroundColor: Colors.surface },
  info: { flex: 1 },
  message: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted },
  messageUnread: { fontFamily: Fonts.bodySemiBold, color: Colors.text, fontWeight: '600' },
  time: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginLeft: Spacing.sm },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyTitle: { fontFamily: Fonts.bodySemiBold, fontSize: 18, color: Colors.text, fontWeight: '600' },
  emptySubtitle: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted },
});
