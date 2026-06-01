import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  Modal,
  Animated,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { fetchWorkspaces, deleteWorkspace } from '@/services/db';

interface Workspace {
  id: string;
  name: string;
  currency: string;
  role: string;
}

export default function WorkspacesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));

  const userInitial = session?.user?.email?.[0]?.toUpperCase() ?? '?';

  const load = () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchWorkspaces(session.user.id)
      .then(setWorkspaces)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [session?.user?.id]);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [session?.user?.id])
  );

  const openModal = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setModalVisible(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      setModalVisible(false);
      setSelectedWorkspace(null);
    });
  };

  const handleEdit = () => {
    closeModal();
    if (selectedWorkspace) {
      router.push(`/(app)/${selectedWorkspace.id}/settings?name=${selectedWorkspace.name}&currency=${selectedWorkspace.currency}` as any);
    }
  };

  const handleDelete = () => {
    if (!selectedWorkspace) return;
    const ws = selectedWorkspace;
    closeModal();
    setTimeout(() => {
      Alert.alert(
        'Delete Space',
        `Are you sure you want to delete "${ws.name}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteWorkspace(ws.id);
                load();
              } catch (e: any) {
                Alert.alert('Error', e.message ?? 'Failed to delete workspace');
              }
            },
          },
        ]
      );
    }, 300);
  };

  const renderWorkspace = ({ item }: { item: Workspace }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/(app)/${item.id}?name=${item.name}&currency=${item.currency}` as any)}
    >
      <View style={styles.cardIcon}>
        <Ionicons name="grid" size={22} color={Colors.primary} />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.name}</Text>
        <View style={styles.cardMeta}>
          <Text style={styles.cardMetaText}>{item.currency}</Text>
          <Text style={styles.cardMetaDot}>·</Text>
          <Text style={styles.cardRole}>{item.role}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.menuBtn}
        onPress={() => openModal(item)}
      >
        <Ionicons name="ellipsis-vertical" size={18} color={Colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Spaces</Text>
        <TouchableOpacity style={styles.avatar} onPress={() => router.push('/(app)/profile' as any)}>
          <Text style={styles.avatarText}>{userInitial}</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={workspaces}
        keyExtractor={(item) => item.id}
        renderItem={renderWorkspace}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="grid-outline" size={48} color={Colors.border} />
            <Text style={styles.emptyTitle}>No spaces yet</Text>
            <Text style={styles.emptySubtitle}>Create a space to get started</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => router.push('/(app)/create-workspace' as any)}
      >
        <Ionicons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={closeModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeModal}
        >
          <Animated.View
            style={[
              styles.modalContent,
              { opacity: fadeAnim },
            ]}
          >
            <TouchableOpacity
              style={styles.modalOption}
              onPress={handleEdit}
            >
              <Ionicons name="pencil-outline" size={18} color={Colors.text} />
              <Text style={styles.modalOptionText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalOption, styles.modalOptionDelete]}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.error} />
              <Text style={[styles.modalOptionText, styles.modalOptionTextDelete]}>Delete</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  title: {
    fontFamily: Fonts.bodyBold,
    fontSize: 24,
    color: Colors.text,
    fontWeight: '700',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.white,
    fontFamily: Fonts.bodyBold,
    fontWeight: '700',
    fontSize: 15,
  },
  list: {
    padding: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMetaText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  cardMetaDot: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  cardRole: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.primary,
  },
  menuBtn: {
    padding: 8,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 18,
    color: Colors.text,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textMuted,
  },
  fab: {
    position: 'absolute',
    bottom: 80,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    minWidth: 150,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalOptionDelete: {
    borderBottomWidth: 0,
  },
  modalOptionText: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: Colors.text,
  },
  modalOptionTextDelete: {
    color: Colors.error,
  },
});
