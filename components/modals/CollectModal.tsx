import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
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
  step: 'account' | 'mode';
  setStep: (s: 'account' | 'mode') => void;
  mode: 'full' | 'manual' | 'split';
  setMode: (m: 'full' | 'manual' | 'split') => void;
  manualAmount: string;
  setManualAmount: (v: string) => void;
  selectedPeople: string[];
  setSelectedPeople: (fn: (prev: string[]) => string[]) => void;
  accounts: any[];
  account: any;
  setAccount: (a: any) => void;
  date: string;
  setDate: (d: string) => void;
  complete: boolean | null;
  setComplete: (v: boolean | null) => void;
  loading: boolean;
  getAmount: () => number;
  onConfirm: () => void;
  spaces: { id: string; name: string }[];
  spaceId: string | null;
  setSpaceId: (id: string | null) => void;
  defaultSpaceId: string | null;
}

export default function CollectModal({ visible, onClose, recording, items, filledPeople, step, setStep, mode, setMode, manualAmount, setManualAmount, selectedPeople, setSelectedPeople, accounts, account, setAccount, date, setDate, complete, setComplete, loading, getAmount, onConfirm, spaces, spaceId, setSpaceId, defaultSpaceId }: Props) {
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
    <BottomSheet visible={visible} onClose={onClose} sub="receivable" title={step === 'account' ? 'receive into' : 'collect payment'}>
      {step === 'account' ? (
        <>
          <Text style={formStyles.hintMuted}>which account are you receiving into?</Text>
          <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
            {accounts.map((acc: any) => (
              <TouchableOpacity key={acc.id} style={[accountStyles.option, account?.id === acc.id && accountStyles.optionActive]} onPress={() => setAccount(acc)}>
                <View style={{ flex: 1 }}>
                  <Text style={[accountStyles.optionName, account?.id === acc.id && accountStyles.optionNameActive]}>{acc.holder_name || acc.account_name}</Text>
                  <Text style={[accountStyles.optionBank, account?.id === acc.id && accountStyles.optionBankActive]}>{acc.bank} · {acc.account_number}</Text>
                </View>
                {account?.id === acc.id && <Ionicons name="checkmark" size={14} color={Colors.white} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={formStyles.actions}>
            <TouchableOpacity style={formStyles.cancelBtn} onPress={onClose}>
              <Text style={formStyles.cancelBtnText}>cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[formStyles.primaryBtn, !account && { opacity: 0.4 }]} onPress={() => setStep('mode')} disabled={!account}>
              <Text style={formStyles.primaryBtnText}>next</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={{ gap: 12, width: '100%' }}>
          <Text style={formStyles.hintMuted}>{(recording?.name ?? '').toLowerCase()} · {Number(recording?.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
          <Text style={[formStyles.hintMuted, { color: Colors.cyan }]}>{account?.holder_name || account?.account_name} · {account?.bank}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(['full', 'manual', ...(filledPeople.length > 0 && items.length > 0 ? ['split'] : [])] as const).map(m => (
              <TouchableOpacity key={m} style={[itemStyles.personSelectChip, { flex: 1, justifyContent: 'center' }, mode === m && itemStyles.personSelectChipActive]} onPress={() => setMode(m as any)}>
                <Text style={[itemStyles.personSelectText, mode === m && itemStyles.personSelectTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {mode === 'full' && <Text style={{ fontFamily: Fonts.monoBold, fontSize: 22, color: Colors.cyan }}>{Number(recording?.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>}
          {mode === 'manual' && <TextInput style={[formStyles.input, { width: '100%' }]} placeholder="0.00" placeholderTextColor={Colors.faint} value={manualAmount} onChangeText={setManualAmount} keyboardType="decimal-pad" autoFocus />}
          {mode === 'split' && (
            <View style={{ gap: 8 }}>
              <Text style={formStyles.hintMuted}>select who collected this session</Text>
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
              {selectedPeople.length > 0 && <Text style={{ fontFamily: Fonts.monoBold, fontSize: 18, color: Colors.cyan }}>{getAmount().toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>}
            </View>
          )}
          <View style={{ gap: 4 }}>
            <Text style={formStyles.hintMuted}>collection date</Text>
            <TextInput style={[formStyles.input, { width: '100%' }]} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.faint} value={date} onChangeText={setDate} />
          </View>
          {/* Space picker */}
          <View style={{ gap: 8 }}>
            <Text style={formStyles.hintMuted}>record collection in</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 999, borderWidth: 1, alignItems: 'center' as const, borderColor: spaceId === defaultSpaceId ? Colors.cyan : Colors.borderMid, backgroundColor: spaceId === defaultSpaceId ? Colors.cyan + '22' : Colors.white }}
                onPress={() => setSpaceId(defaultSpaceId)}
              >
                <Text style={{ fontFamily: Fonts.monoBold, fontSize: 11, color: spaceId === defaultSpaceId ? Colors.cyan : Colors.muted }}>same space</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 999, borderWidth: 1, alignItems: 'center' as const, borderColor: spaceId !== defaultSpaceId ? Colors.cyan : Colors.borderMid, backgroundColor: spaceId !== defaultSpaceId ? Colors.cyan + '22' : Colors.white }}
                onPress={() => { if (spaceId === defaultSpaceId) setSpaceId(spaces.find(s => s.id !== defaultSpaceId)?.id ?? defaultSpaceId); }}
              >
                <Text style={{ fontFamily: Fonts.monoBold, fontSize: 11, color: spaceId !== defaultSpaceId ? Colors.cyan : Colors.muted }}>different space</Text>
              </TouchableOpacity>
            </View>
            {spaceId !== defaultSpaceId && (
              <ScrollView style={{ maxHeight: 140 }} showsVerticalScrollIndicator={false}>
                {spaces.filter(s => s.id !== defaultSpaceId).map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={{ paddingVertical: 11, paddingHorizontal: 14, borderRadius: 8, marginBottom: 4, borderWidth: 1, borderColor: spaceId === s.id ? Colors.cyan : Colors.borderMid, backgroundColor: spaceId === s.id ? Colors.cyan + '22' : Colors.white }}
                    onPress={() => setSpaceId(s.id)}
                  >
                    <Text style={{ fontFamily: Fonts.monoBold, fontSize: 13, color: spaceId === s.id ? Colors.cyan : Colors.text }}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
          <View style={{ gap: 4 }}>
            <Text style={formStyles.hintMuted}>complete collection?</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([true, false] as const).map(val => (
                <TouchableOpacity key={String(val)} style={[itemStyles.personSelectChip, { flex: 1, justifyContent: 'center' }, complete === val && itemStyles.personSelectChipActive]} onPress={() => setComplete(val)}>
                  <Text style={[itemStyles.personSelectText, complete === val && itemStyles.personSelectTextActive]}>{val ? 'yes, complete' : 'no, partial'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={formStyles.actions}>
            <TouchableOpacity style={formStyles.cancelBtn} onPress={() => setStep('account')}>
              <Text style={formStyles.cancelBtnText}>back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[formStyles.primaryBtn, (complete === null || getAmount() <= 0 || loading) && { opacity: 0.4 }]} onPress={onConfirm} disabled={complete === null || getAmount() <= 0 || loading}>
              <Text style={formStyles.primaryBtnText}>{loading ? 'saving...' : 'confirm'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </BottomSheet>
  );
}
