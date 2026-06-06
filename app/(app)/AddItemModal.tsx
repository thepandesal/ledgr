import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@/components/ui/BottomSheet';
import formStyles from '@/components/ui/formStyles';
import itemStyles from '@/components/ui/itemStyles';
import { Colors, Fonts } from '@/components/ui/theme';

interface SubitemForm { name: string; people: string[]; }
interface ItemForm { name: string; cost: string; people: string[]; subitemForms: SubitemForm[]; }

interface Props {
  visible: boolean;
  itemForms: ItemForm[];
  filledPeople: string[];
  recording: any;
  existingItemsTotal: number;
  onClose: () => void;
  onSave: () => void;
  updateItemForm: (i: number, field: 'name' | 'cost', val: string) => void;
  removeItemForm: (i: number) => void;
  addItemForm: () => void;
  toggleItemFormPerson: (i: number, person: string) => void;
  addSubitemForm: (itemIdx: number) => void;
  updateSubitemForm: (itemIdx: number, subIdx: number, field: 'name', val: string) => void;
  removeSubitemForm: (itemIdx: number, subIdx: number) => void;
  toggleSubitemFormPerson: (itemIdx: number, subIdx: number, person: string) => void;
  MAX_ITEM_NAME: number;
}

export default function AddItemModal({
  visible, itemForms, filledPeople, recording, existingItemsTotal,
  onClose, onSave, updateItemForm, removeItemForm, addItemForm,
  toggleItemFormPerson, addSubitemForm, updateSubitemForm,
  removeSubitemForm, toggleSubitemFormPerson, MAX_ITEM_NAME,
}: Props) {
  const recAmt = recording ? Number(recording.amount) : 0;
  const addingTotal = itemForms.reduce((s, f) => s + parseFloat(f.cost || '0'), 0);
  const totalUsed = existingItemsTotal + addingTotal;
  const pct = recAmt > 0 ? Math.min(totalUsed / recAmt, 1) : 0;
  const overBudget = recAmt > 0 && totalUsed > recAmt + 0.01;
  const canSave = itemForms.some(f => f.name.trim() && f.cost) && !overBudget;

  return (
    <BottomSheet visible={visible} onClose={onClose} sub="split bill" title="add items">

      {/* Budget bar */}
      {recAmt > 0 && (
        <View style={{ marginBottom: 12 }}>
          <View style={{ height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' }}>
            <View style={{ height: 4, borderRadius: 2, width: `${pct * 100}%` as any, backgroundColor: overBudget ? Colors.expense : Colors.cyan }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: overBudget ? Colors.expense : Colors.cyan }}>
              {totalUsed.toLocaleString('en-US', { minimumFractionDigits: 2 })} allocated
            </Text>
            <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted }}>
              {recAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })} total
            </Text>
          </View>
        </View>
      )}

      {itemForms.map((form, itemIdx) => {
        const filledSubs = form.subitemForms.filter(sub => sub.name.trim());
        const costNum = parseFloat(form.cost) || 0;
        const equalCost = filledSubs.length > 0 ? costNum / filledSubs.length : 0;

        return (
          <View key={itemIdx} style={formStyles.card}>
            {/* Item name + cost */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <View style={itemStyles.itemCardNum}>
                <Text style={itemStyles.itemCardNumText}>{itemIdx + 1}</Text>
              </View>
              <View style={{ flex: 1, flexDirection: 'row', gap: 8, overflow: 'hidden' }}>
                <TextInput
                  style={[formStyles.input, { flex: 1 }]}
                  placeholder="item name"
                  placeholderTextColor={Colors.faint}
                  value={form.name}
                  onChangeText={v => updateItemForm(itemIdx, 'name', v.slice(0, MAX_ITEM_NAME))}
                  autoFocus={itemIdx === 0}
                />
                <TextInput
                  style={[formStyles.input, { width: 80, textAlign: 'right', color: overBudget && form.cost ? Colors.expense : Colors.text }]}
                  placeholder="0.00"
                  placeholderTextColor={Colors.faint}
                  value={form.cost}
                  onChangeText={v => updateItemForm(itemIdx, 'cost', v)}
                  keyboardType="decimal-pad"
                />
              </View>
              {itemForms.length > 1 && (
                <TouchableOpacity onPress={() => removeItemForm(itemIdx)} style={{ padding: 6 }}>
                  <Ionicons name="close" size={16} color={Colors.faint} />
                </TouchableOpacity>
              )}
            </View>

            {/* People (no subitems) */}
            {form.subitemForms.length === 0 && filledPeople.length > 0 && (
              <View style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border }}>
                <Text style={formStyles.sectionLabel}>who's included</Text>
                <View style={itemStyles.personSelectRow}>
                  {filledPeople.map((p, pi) => {
                    const sel = form.people.includes(p);
                    return (
                      <TouchableOpacity key={pi} style={[itemStyles.personSelectChip, sel && itemStyles.personSelectChipActive]} onPress={() => toggleItemFormPerson(itemIdx, p)}>
                        <Text style={[itemStyles.personSelectText, sel && itemStyles.personSelectTextActive]}>{p}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {form.people.length > 0 && costNum > 0 && (
                  <Text style={{ fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.cyan, marginTop: 6 }}>
                    {(costNum / form.people.length).toLocaleString('en-US', { minimumFractionDigits: 2 })} each
                  </Text>
                )}
              </View>
            )}

            {/* Subitems */}
            {form.subitemForms.length > 0 && (
              <View style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border }}>
                <Text style={formStyles.sectionLabel}>
                  subitems · {filledSubs.length > 0 ? `${equalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} each` : 'enter cost above'}
                </Text>
                {form.subitemForms.map((sub, subIdx) => (
                  <View key={subIdx} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={itemStyles.subitemArrow}>↳</Text>
                      <View style={{ flex: 1, gap: 4 }}>
                        <TextInput
                          style={formStyles.input}
                          placeholder={`subitem ${subIdx + 1}`}
                          placeholderTextColor={Colors.faint}
                          value={sub.name}
                          onChangeText={v => updateSubitemForm(itemIdx, subIdx, 'name', v.slice(0, MAX_ITEM_NAME))}
                        />
                        {costNum > 0 && sub.name.trim() && (
                          <Text style={formStyles.hint}>{equalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} each</Text>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => removeSubitemForm(itemIdx, subIdx)} style={{ padding: 4, flexShrink: 0 }}>
                        <Ionicons name="close" size={12} color={Colors.faint} />
                      </TouchableOpacity>
                    </View>
                    {filledPeople.length > 0 && (
                      <View style={[itemStyles.personSelectRow, { marginLeft: 20, marginTop: 6 }]}>
                        {filledPeople.map((p, pi) => {
                          const sel = sub.people.includes(p);
                          return (
                            <TouchableOpacity key={pi} style={[itemStyles.personSelectChip, sel && itemStyles.personSelectChipActive]} onPress={() => toggleSubitemFormPerson(itemIdx, subIdx, p)}>
                              <Text style={[itemStyles.personSelectText, sel && itemStyles.personSelectTextActive]}>{p}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Add subitem */}
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }} onPress={() => addSubitemForm(itemIdx)}>
              <Ionicons name="add" size={12} color={Colors.cyan} />
              <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: Colors.cyan }}>add subitem</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 14, justifyContent: 'center' }} onPress={addItemForm}>
        <Ionicons name="add-circle-outline" size={16} color={Colors.cyan} />
        <Text style={{ fontFamily: Fonts.mono, fontSize: 13, color: Colors.cyan }}>add another item</Text>
      </TouchableOpacity>

      <View style={formStyles.actions}>
        <TouchableOpacity style={formStyles.cancelBtn} onPress={onClose}>
          <Text style={formStyles.cancelBtnText}>cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[formStyles.primaryBtn, !canSave && { opacity: 0.4 }]} onPress={onSave} disabled={!canSave}>
          <Text style={formStyles.primaryBtnText}>save</Text>
        </TouchableOpacity>
      </View>

    </BottomSheet>
  );
}

