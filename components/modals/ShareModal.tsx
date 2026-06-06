import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import ConfirmModal from '@/components/ui/ConfirmModal';
import formStyles from '@/components/ui/formStyles';
import accountStyles from '@/components/ui/accountStyles';
import { Colors } from '@/components/ui/theme';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  shareRowId: string | null;
  shareAccounts: any[];
  selectedAccountIds: string[];
  setSelectedAccountIds: (fn: (prev: string[]) => string[]) => void;
  linkCopied: boolean;
  shareLoading: boolean;
  onShare: () => void;
  onSaveImage: () => void;
}

export default function ShareModal({ visible, onClose, shareRowId, shareAccounts, selectedAccountIds, setSelectedAccountIds, linkCopied, shareLoading, onShare, onSaveImage }: Props) {
  return (
    <ConfirmModal
      visible={visible}
      onClose={onClose}
      title="share split"
      actions={[{ label: 'cancel', onPress: onClose, muted: true }]}
    >
      <Text style={formStyles.hintMuted}>choose payment account(s)</Text>
      <ScrollView style={{ width: '100%', maxHeight: 200 }} showsVerticalScrollIndicator={false}>
        {shareAccounts.map((acc: any) => {
          const selected = selectedAccountIds.includes(acc.id);
          return (
            <TouchableOpacity
              key={acc.id}
              style={[accountStyles.option, selected && accountStyles.optionActive]}
              onPress={() => setSelectedAccountIds(prev => selected ? prev.filter(id => id !== acc.id) : [...prev, acc.id])}
            >
              <View style={{ flex: 1 }}>
                <Text style={[accountStyles.optionName, selected && accountStyles.optionNameActive]}>{acc.account_name}</Text>
                <Text style={[accountStyles.optionBank, selected && accountStyles.optionBankActive]}>{acc.bank} · {acc.account_number}</Text>
              </View>
              <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={18} color={selected ? Colors.white : Colors.faint} />
            </TouchableOpacity>
          );
        })}
        {shareAccounts.length === 0 && <Text style={[formStyles.hintMuted, { textAlign: 'center', marginVertical: 8 }]}>no accounts saved</Text>}
      </ScrollView>
      <View style={accountStyles.shareRow}>
        <TouchableOpacity style={[accountStyles.shareBtn, !shareRowId && { opacity: 0.4 }, linkCopied && { borderColor: Colors.income, backgroundColor: Colors.successBg }]} onPress={onShare} disabled={!shareRowId}>
          <Ionicons name={linkCopied ? 'checkmark' : 'link-outline'} size={18} color={linkCopied ? Colors.income : Colors.cyan} />
          <Text style={[accountStyles.shareBtnText, linkCopied && { color: Colors.income }]}>{!shareRowId ? 'preparing...' : linkCopied ? 'link copied!' : 'share link'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[accountStyles.shareBtn, shareLoading && { opacity: 0.4 }]} onPress={onSaveImage} disabled={shareLoading}>
          <Ionicons name="image-outline" size={18} color={Colors.text} />
          <Text style={[accountStyles.shareBtnText, { color: Colors.text }]}>{shareLoading ? 'saving...' : 'save as pdf'}</Text>
        </TouchableOpacity>
      </View>
      {shareRowId && (
        <TextInput
          style={[formStyles.input, { width: '100%', fontSize: 11, color: Colors.muted }]}
          value={`https://ledgr.art/split/${shareRowId}`}
          editable
          selectTextOnFocus
          caretHidden={false}
        />
      )}
    </ConfirmModal>
  );
}
