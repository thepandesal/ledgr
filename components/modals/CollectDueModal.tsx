import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useState } from 'react';
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
  chargeToSpace: boolean;
  setChargeToSpace: (v: boolean) => void;
  chargeSpaceId: string | null;
  setChargeSpaceId: (id: string | null) => void;
  chargeAccounts: { id: string; account_name: string; bank: string }[];
  chargeAccountId: string | null;
  setChargeAccountId: (id: string | null) => void;
  chargeCategories: { id: string; name: string }[];
  chargeCategoryId: string | null;
  setChargeCategoryId: (id: string | null) => void;
}

export default function CollectDueModal({
  visible, onClose, recordingName, recordingAmount,
  amount, setAmount, date, setDate,
  complete, setComplete, loading, onConfirm,
  spaces, spaceId, setSpaceId, defaultSpaceId,
  chargeToSpace, setChargeToSpace, chargeSpaceId, setChargeSpaceId,
  chargeAccounts, chargeAccountId, setChargeAccountId,
  chargeCategories, chargeCategoryId, setChargeCategoryId,
}: Props) {
  const [showSpaceDropdown, setShowSpaceDropdown] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const parsedAmount = parseFloat(amount || '0') || 0;
  const canConfirm = parsedAmount > 0 && complete !== null && !loading && (!chargeToSpace || !!chargeSpaceId);
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

        {/* Charge to space */}
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.borderMid }}
          onPress={() => setChargeToSpace(!chargeToSpace)}
          activeOpacity={0.7}
        >
          <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: chargeToSpace ? Colors.cyan : Colors.borderMid, backgroundColor: chargeToSpace ? Colors.cyan + '22' : Colors.white, alignItems: 'center', justifyContent: 'center' }}>
            {chargeToSpace && <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: Colors.cyan }} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text }}>charge to a space</Text>
            <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted }}>creates an expense on the selected space</Text>
          </View>
        </TouchableOpacity>
        {chargeToSpace && (
          <View style={{ gap: 8 }}>
            {/* Space dropdown */}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface }}
              onPress={() => { setShowSpaceDropdown(v => !v); setShowAccountDropdown(false); setShowCategoryDropdown(false); }}
            >
              <Text style={{ fontFamily: Fonts.monoBold, fontSize: 13, color: chargeSpaceId ? Colors.text : Colors.faint }}>
                {chargeSpaceId ? (spaces.find(s => s.id === chargeSpaceId)?.name ?? 'select space') : 'select space'}
              </Text>
              <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted }}>{showSpaceDropdown ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showSpaceDropdown && (
              <ScrollView style={{ maxHeight: 160, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderMid }} showsVerticalScrollIndicator={false}>
                {[...spaces].sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={{ paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: chargeSpaceId === s.id ? Colors.cyan + '22' : Colors.white }}
                    onPress={() => { setChargeSpaceId(s.id); setShowSpaceDropdown(false); }}
                  >
                    <Text style={{ fontFamily: Fonts.monoBold, fontSize: 13, color: chargeSpaceId === s.id ? Colors.cyan : Colors.text }}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {/* Account dropdown */}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface }}
              onPress={() => { setShowAccountDropdown(v => !v); setShowSpaceDropdown(false); setShowCategoryDropdown(false); }}
            >
              <Text style={{ fontFamily: Fonts.monoBold, fontSize: 13, color: chargeAccountId ? Colors.text : Colors.faint }}>
                {chargeAccountId ? (chargeAccounts.find(a => a.id === chargeAccountId)?.account_name ?? 'select account') : 'account (optional)'}
              </Text>
              <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted }}>{showAccountDropdown ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showAccountDropdown && (
              <ScrollView style={{ maxHeight: 160, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderMid }} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={{ paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: !chargeAccountId ? Colors.cyan + '22' : Colors.white }}
                  onPress={() => { setChargeAccountId(null); setShowAccountDropdown(false); }}
                >
                  <Text style={{ fontFamily: Fonts.mono, fontSize: 13, color: Colors.muted }}>none</Text>
                </TouchableOpacity>
                {[...chargeAccounts].sort((a, b) => a.account_name.localeCompare(b.account_name)).map(a => (
                  <TouchableOpacity
                    key={a.id}
                    style={{ paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: chargeAccountId === a.id ? Colors.cyan + '22' : Colors.white }}
                    onPress={() => { setChargeAccountId(a.id); setShowAccountDropdown(false); }}
                  >
                    <Text style={{ fontFamily: Fonts.monoBold, fontSize: 13, color: chargeAccountId === a.id ? Colors.cyan : Colors.text }}>{a.account_name}</Text>
                    <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted }}>{a.bank}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {/* Category dropdown */}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface }}
              onPress={() => { setShowCategoryDropdown(v => !v); setShowSpaceDropdown(false); setShowAccountDropdown(false); }}
            >
              <Text style={{ fontFamily: Fonts.monoBold, fontSize: 13, color: chargeCategoryId ? Colors.text : Colors.faint }}>
                {chargeCategoryId ? (chargeCategories.find(c => c.id === chargeCategoryId)?.name ?? 'select category') : 'category (optional)'}
              </Text>
              <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted }}>{showCategoryDropdown ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showCategoryDropdown && (
              <ScrollView style={{ maxHeight: 160, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderMid }} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={{ paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: !chargeCategoryId ? Colors.cyan + '22' : Colors.white }}
                  onPress={() => { setChargeCategoryId(null); setShowCategoryDropdown(false); }}
                >
                  <Text style={{ fontFamily: Fonts.mono, fontSize: 13, color: Colors.muted }}>none</Text>
                </TouchableOpacity>
                {[...chargeCategories].sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={{ paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: chargeCategoryId === c.id ? Colors.cyan + '22' : Colors.white }}
                    onPress={() => { setChargeCategoryId(c.id); setShowCategoryDropdown(false); }}
                  >
                    <Text style={{ fontFamily: Fonts.monoBold, fontSize: 13, color: chargeCategoryId === c.id ? Colors.cyan : Colors.text }}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

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
