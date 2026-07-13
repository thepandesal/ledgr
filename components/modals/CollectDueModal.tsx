import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import BottomSheet from '@/components/ui/BottomSheet';
import formStyles from '@/components/ui/formStyles';
import { Colors, Fonts, Radius } from '@/components/ui/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  recordingName: string;
  recordingAmount: number;
  amount: string;
  setAmount: (v: string) => void;
  date: string;
  setDate: (d: string) => void;
  complete: boolean | null;
  setComplete: (v: boolean | null) => void;
  loading: boolean;
  onConfirm: () => void;
  spaces: { id: string; name: string }[];
  spaceId: string | null;
  setSpaceId: (id: string | null) => void;
  defaultSpaceId: string | null;
}

export default function CollectDueModal({
  visible, onClose, recordingName, recordingAmount,
  amount, setAmount, date, setDate,
  complete, setComplete, loading, onConfirm,
  spaces, spaceId, setSpaceId, defaultSpaceId,
}: Props) {
  const parsedAmount = parseFloat(amount || '0') || 0;
  const canConfirm = parsedAmount > 0 && complete !== null && !loading;
  const usingSameSpace = spaceId === defaultSpaceId;

  return (
    <BottomSheet visible={visible} onClose={onClose} sub="expense" title="collect payment">
      <View style={{ gap: 14, width: '100%' }}>
        <Text style={formStyles.hintMuted}>
          {recordingName.toLowerCase()} · {recordingAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Text>

        <View style={{ gap: 4 }}>
          <Text style={formStyles.hintMuted}>how much have you collected?</Text>
          <TextInput
            style={[formStyles.input, { width: '100%' }]}
            placeholder="0.00"
            placeholderTextColor={Colors.faint}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            autoFocus
          />
          {parsedAmount > 0 && (
            <Text style={{ fontFamily: Fonts.monoBold, fontSize: 22, color: Colors.cyan }}>
              {parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
          )}
        </View>

        <View style={{ gap: 4 }}>
          <Text style={formStyles.hintMuted}>collection date</Text>
          <TextInput
            style={[formStyles.input, { width: '100%' }]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.faint}
            value={date}
            onChangeText={setDate}
          />
        </View>

        {/* Space picker */}
        <View style={{ gap: 8 }}>
          <Text style={formStyles.hintMuted}>record collection in</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={{ flex: 1, paddingVertical: 10, borderRadius: 999, borderWidth: 1, alignItems: 'center', borderColor: usingSameSpace ? Colors.cyan : Colors.borderMid, backgroundColor: usingSameSpace ? Colors.cyan + '22' : Colors.white }}
              onPress={() => setSpaceId(defaultSpaceId)}
            >
              <Text style={{ fontFamily: Fonts.monoBold, fontSize: 11, color: usingSameSpace ? Colors.cyan : Colors.muted }}>same space</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, paddingVertical: 10, borderRadius: 999, borderWidth: 1, alignItems: 'center', borderColor: !usingSameSpace ? Colors.cyan : Colors.borderMid, backgroundColor: !usingSameSpace ? Colors.cyan + '22' : Colors.white }}
              onPress={() => { if (usingSameSpace && spaces.length > 0) setSpaceId(spaces.find(s => s.id !== defaultSpaceId)?.id ?? defaultSpaceId); }}
            >
              <Text style={{ fontFamily: Fonts.monoBold, fontSize: 11, color: !usingSameSpace ? Colors.cyan : Colors.muted }}>different space</Text>
            </TouchableOpacity>
          </View>
          {!usingSameSpace && (
            <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
              {spaces.filter(s => s.id !== defaultSpaceId).map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: Radius.md, marginBottom: 4, borderWidth: 1, borderColor: spaceId === s.id ? Colors.cyan : Colors.borderMid, backgroundColor: spaceId === s.id ? Colors.cyan + '22' : Colors.white }}
                  onPress={() => setSpaceId(s.id)}
                >
                  <Text style={{ fontFamily: Fonts.monoBold, fontSize: 13, color: spaceId === s.id ? Colors.cyan : Colors.text }}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={{ gap: 4 }}>
          <Text style={formStyles.hintMuted}>is this the full collection?</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([true, false] as const).map(val => (
              <TouchableOpacity
                key={String(val)}
                style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: complete === val ? Colors.cyan : Colors.borderMid, backgroundColor: complete === val ? Colors.cyan + '22' : Colors.white }}
                onPress={() => setComplete(val)}
              >
                <Text style={{ fontFamily: Fonts.monoBold, fontSize: 11, color: complete === val ? Colors.cyan : Colors.muted }}>
                  {val ? 'yes, fully collected' : 'no, partial'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={formStyles.actions}>
          <TouchableOpacity style={formStyles.cancelBtn} onPress={onClose}>
            <Text style={formStyles.cancelBtnText}>cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[formStyles.primaryBtn, !canConfirm && { opacity: 0.4 }]}
            onPress={onConfirm}
            disabled={!canConfirm}
          >
            <Text style={formStyles.primaryBtnText}>{loading ? 'saving...' : 'record collection'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
}
