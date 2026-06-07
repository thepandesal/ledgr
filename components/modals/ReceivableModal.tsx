import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import BottomSheet from '@/components/ui/BottomSheet';
import formStyles from '@/components/ui/formStyles';
import itemStyles from '@/components/ui/itemStyles';
import accountStyles from '@/components/ui/accountStyles';
import { Colors, Fonts } from '@/components/ui/theme';
import { Ionicons } from '@expo/vector-icons';

interface Item { id: string; name: string; cost: number; people: string[]; subitems: { id: string; name: string; cost: number; people: string[] }[]; }

interface Props {
  visible: boolean;
  onClose: () => void;
  recording: any;
  items: Item[];
  filledPeople: string[];
  mode: 'full' | 'manual' | 'split';
  setMode: (m: 'full' | 'manual' | 'split') => void;
  manualAmount: string;
  setManualAmount: (v: string) => void;
  selectedPeople: string[];
  setSelectedPeople: (fn: (prev: string[]) => string[]) => void;
  loading: boolean;
  getAmount: () => number;
  onConfirm: () => void;
}

export default function ReceivableModal({ visible, onClose, recording, items, filledPeople, mode, setMode, manualAmount, setManualAmount, selectedPeople, setSelectedPeople, loading, getAmount, onConfirm }: Props) {
  const perPersonMap: Record<string, number> = {};
  items.forEach(item => {
    const calc = (people: string[], cost: number) => {
      const pp = people.length > 0 ? cost / people.length : 0;
      people.forEach(p => { perPersonMap[p] = (perPersonMap[p] || 0) + pp; });
    };
    if (item.subitems.length === 0) calc(item.people, item.cost);
    else item.subitems.forEach(s => calc(s.people, s.cost));
  });

  return (
    <BottomSheet visible={visible} onClose={onClose} sub="expense" title="create receivable">
      <View style={{ gap: 12, width: '100%' }}>
      <Text style={formStyles.hintMuted}>{(recording?.name ?? '').toLowerCase()} · {Number(recording?.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
      <View style={{ flexDirection: 'row', gap: 6, width: '100%' }}>
        {(['full', 'manual', ...(filledPeople.length > 0 && items.length > 0 ? ['split'] : [])] as const).map(m => (
          <TouchableOpacity key={m} style={[itemStyles.personSelectChip, { flex: 1, justifyContent: 'center' }, mode === m && itemStyles.personSelectChipActive]} onPress={() => setMode(m as any)}>
            <Text style={[itemStyles.personSelectText, mode === m && itemStyles.personSelectTextActive]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {mode === 'full' && (
        <Text style={{ fontFamily: Fonts.monoBold, fontSize: 22, color: Colors.cyan }}>
          {Number(recording?.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Text>
      )}
      {mode === 'manual' && (
        <TextInput style={[formStyles.input, { width: '100%' }]} placeholder="0.00" placeholderTextColor={Colors.faint} value={manualAmount} onChangeText={setManualAmount} keyboardType="decimal-pad" autoFocus />
      )}
      {mode === 'split' && (
        <View style={{ width: '100%', gap: 8 }}>
          <Text style={formStyles.hintMuted}>select who owes you</Text>
          {filledPeople.map((p, i) => {
            const sel = selectedPeople.includes(p);
            return (
              <TouchableOpacity key={i} style={[accountStyles.option, sel && accountStyles.optionActive]} onPress={() => setSelectedPeople(prev => sel ? prev.filter(x => x !== p) : [...prev, p])}>
                <View style={{ flex: 1 }}>
                  <Text style={[accountStyles.optionName, sel && accountStyles.optionNameActive]}>{p}</Text>
                  <Text style={[accountStyles.optionBank, sel && accountStyles.optionBankActive]}>{(perPersonMap[p] ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                </View>
                <Ionicons name={sel ? 'checkbox' : 'square-outline'} size={18} color={sel ? Colors.white : Colors.faint} />
              </TouchableOpacity>
            );
          })}
          {selectedPeople.length > 0 && (
            <Text style={{ fontFamily: Fonts.monoBold, fontSize: 18, color: Colors.cyan }}>
              {getAmount().toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
          )}
        </View>
      )}
      </View>
      <View style={formStyles.actions}>
        <TouchableOpacity style={formStyles.cancelBtn} onPress={onClose}>
          <Text style={formStyles.cancelBtnText}>cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[formStyles.primaryBtn, (getAmount() <= 0 || loading) && { opacity: 0.4 }]}
          onPress={onConfirm}
          disabled={getAmount() <= 0 || loading}
        >
          <Text style={formStyles.primaryBtnText}>{loading ? 'creating...' : 'create'}</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}
