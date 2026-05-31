import { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { router } from 'expo-router';
import { fetchWorkspaces, createWorkspace } from '../../../src/services';
import { Workspace } from '../../../src/types';
import { PageHeader, Card, Button, Modal, Input, ChipSelect, EmptyState } from '../../../src/components/ui';
import { Colors, Fonts, Spacing } from '../../../src/constants/theme';

const CURRENCIES = ['PHP', 'USD', 'EUR', 'JPY', 'GBP', 'AUD', 'SGD', 'KRW', 'THB', 'MYR'];

export default function SpacesScreen() {
  const [spaces, setSpaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [currency, setCurrency] = useState('PHP');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadSpaces();
  }, []);

  const loadSpaces = async () => {
    const data = await fetchWorkspaces();
    setSpaces(data);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!spaceName.trim()) return;
    setCreating(true);
    const space = await createWorkspace(spaceName.trim(), currency);
    if (space) setSpaces([...spaces, space]);
    setSpaceName('');
    setCurrency('PHP');
    setCreating(false);
    setModalVisible(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PageHeader title="Your Spaces" />
      <FlatList
        data={spaces}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/(tabs)/spaces/workspace/${item.id}`)}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSub}>{item.default_currency}</Text>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState icon="🏠" title="No spaces yet" subtitle="Create your first space to get started" />
        }
        ListFooterComponent={
          <Button title="+ Create Space" onPress={() => setModalVisible(true)} />
        }
      />

      <Modal visible={modalVisible} title="Create a Space" onClose={() => setModalVisible(false)}>
        <Input
          label="Space Name"
          placeholder="e.g. Household, Trip to Japan"
          value={spaceName}
          onChangeText={setSpaceName}
        />
        <ChipSelect
          label="Default Currency"
          options={CURRENCIES}
          selected={currency}
          onSelect={setCurrency}
        />
        <View style={styles.modalActions}>
          <Button title="Cancel" variant="secondary" onPress={() => setModalVisible(false)} style={styles.flex} />
          <Button
            title="Create"
            onPress={handleCreate}
            loading={creating}
            disabled={!spaceName.trim()}
            style={styles.flex}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  list: { padding: Spacing.md },
  cardTitle: { fontFamily: Fonts.bodySemiBold, fontSize: 16, color: Colors.text },
  cardSub: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  flex: { flex: 1 },
});
