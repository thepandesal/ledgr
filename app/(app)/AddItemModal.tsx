import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width: SW } = Dimensions.get('window');

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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <BlurView intensity={40} tint="light" style={{ ...StyleSheet.absoluteFillObject }} />
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>

          {/* Header */}
          <View style={s.header}>
            <View>
              <Text style={s.headerSub}>split bill</Text>
              <Text style={s.headerTitle}>add items</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={20} color="#929090" />
            </TouchableOpacity>
          </View>

          {/* Budget bar */}
          {recAmt > 0 && (
            <View style={s.budgetBlock}>
              <View style={s.budgetBarBg}>
                <View style={[s.budgetBarFill, { width: `${pct * 100}%` as any, backgroundColor: overBudget ? '#ed6a6a' : '#0ccfcf' }]} />
              </View>
              <View style={s.budgetLabels}>
                <Text style={[s.budgetLeft, overBudget && { color: '#ed6a6a' }]}>
                  {totalUsed.toLocaleString('en-US', { minimumFractionDigits: 2 })} allocated
                </Text>
                <Text style={s.budgetRight}>
                  {recAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })} total
                </Text>
              </View>
            </View>
          )}

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
            {itemForms.map((form, itemIdx) => {
              const filledSubs = form.subitemForms.filter(sub => sub.name.trim());
              const costNum = parseFloat(form.cost) || 0;
              const equalCost = filledSubs.length > 0 ? costNum / filledSubs.length : 0;
              const thisOver = recAmt > 0 && (existingItemsTotal + itemForms.reduce((s, f, fi) => s + parseFloat(fi === itemIdx ? f.cost || '0' : f.cost || '0'), 0)) > recAmt + 0.01;

              return (
                <View key={itemIdx} style={s.itemCard}>
                  {/* Item name + cost */}
                  <View style={s.itemCardTop}>
                    <View style={s.itemCardNum}>
                      <Text style={s.itemCardNumText}>{itemIdx + 1}</Text>
                    </View>
                    <View style={s.itemCardInputs}>
                      <TextInput
                        style={s.itemNameInput}
                        placeholder="item name"
                        placeholderTextColor="#c0c0c0"
                        value={form.name}
                        onChangeText={v => updateItemForm(itemIdx, 'name', v.slice(0, MAX_ITEM_NAME))}
                        autoFocus={itemIdx === 0}
                      />
                      <TextInput
                        style={[s.itemCostInput, overBudget && form.cost ? { color: '#ed6a6a' } : {}]}
                        placeholder="0.00"
                        placeholderTextColor="#c0c0c0"
                        value={form.cost}
                        onChangeText={v => updateItemForm(itemIdx, 'cost', v)}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    {itemForms.length > 1 && (
                      <TouchableOpacity onPress={() => removeItemForm(itemIdx)} style={{ padding: 6 }}>
                        <Ionicons name="close" size={16} color="#c0c0c0" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* People (item level, no subitems) */}
                  {form.subitemForms.length === 0 && filledPeople.length > 0 && (
                    <View style={s.sectionBlock}>
                      <Text style={s.sectionBlockLabel}>who's included</Text>
                      <View style={s.peopleRow}>
                        {filledPeople.map((p, pi) => {
                          const sel = form.people.includes(p);
                          return (
                            <TouchableOpacity key={pi} style={[s.personChip, sel && s.personChipActive]} onPress={() => toggleItemFormPerson(itemIdx, p)}>
                              <Text style={[s.personChipText, sel && { color: '#fff' }]}>{p}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {form.people.length > 0 && form.cost && (
                        <Text style={s.splitPreview}>
                          {(costNum / form.people.length).toLocaleString('en-US', { minimumFractionDigits: 2 })} each
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Subitems */}
                  {form.subitemForms.length > 0 && (
                    <View style={s.sectionBlock}>
                      <Text style={s.sectionBlockLabel}>subitems · {filledSubs.length > 0 ? `${equalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} each` : 'enter cost above'}</Text>
                      {form.subitemForms.map((sub, subIdx) => (
                        <View key={subIdx} style={s.subitemBlock}>
                          <View style={s.subitemInputRow}>
                            <Text style={s.subArrow}>↳</Text>
                            <View style={{ flex: 1, gap: 4 }}>
                              <TextInput
                                style={s.subitemInput}
                                placeholder={`subitem ${subIdx + 1}`}
                                placeholderTextColor="#c0c0c0"
                                value={sub.name}
                                onChangeText={v => updateSubitemForm(itemIdx, subIdx, 'name', v.slice(0, MAX_ITEM_NAME))}
                              />
                              {form.cost && sub.name.trim() && (
                                <Text style={s.subitemCostHint}>{equalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} each</Text>
                              )}
                            </View>
                            <TouchableOpacity onPress={() => removeSubitemForm(itemIdx, subIdx)} style={{ padding: 4, flexShrink: 0 }}>
                              <Ionicons name="close" size={12} color="#c0c0c0" />
                            </TouchableOpacity>
                          </View>
                          {filledPeople.length > 0 && (
                            <View style={[s.peopleRow, { marginLeft: 20, marginTop: 6 }]}>
                              {filledPeople.map((p, pi) => {
                                const sel = sub.people.includes(p);
                                return (
                                  <TouchableOpacity key={pi} style={[s.personChip, sel && s.personChipActive]} onPress={() => toggleSubitemFormPerson(itemIdx, subIdx, p)}>
                                    <Text style={[s.personChipText, sel && { color: '#fff' }]}>{p}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Add subitem link */}
                  <TouchableOpacity style={s.addSubLink} onPress={() => addSubitemForm(itemIdx)}>
                    <Ionicons name="add" size={12} color="#0ccfcf" />
                    <Text style={s.addSubLinkText}>add subitem</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            <TouchableOpacity style={s.addItemLink} onPress={addItemForm}>
              <Ionicons name="add-circle-outline" size={16} color="#0ccfcf" />
              <Text style={s.addItemLinkText}>add another item</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelBtnText}>cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, !canSave && { opacity: 0.4 }]} onPress={onSave} disabled={!canSave}>
              <Text style={s.saveBtnText}>save</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 0, maxHeight: '90%', flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  headerSub: { fontFamily: 'ChillaxMedium', fontSize: 11, color: '#929090' },
  headerTitle: { fontFamily: 'Avenelle', fontSize: 26, color: '#425252', letterSpacing: -0.5, lineHeight: 30 },
  closeBtn: { padding: 4 },
  budgetBlock: { marginBottom: 16 },
  budgetBarBg: { height: 4, backgroundColor: '#f0f0f0', borderRadius: 2, overflow: 'hidden' },
  budgetBarFill: { height: 4, borderRadius: 2 },
  budgetLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  budgetLeft: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#0ccfcf' },
  budgetRight: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090' },
  itemCard: { backgroundColor: '#fafafa', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  itemCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  itemCardNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#0ccfcf', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  itemCardNumText: { fontFamily: 'RobotoMono_700Bold', fontSize: 11, color: '#fff' },
  itemCardInputs: { flex: 1, flexDirection: 'row', gap: 8, overflow: 'hidden' },
  itemNameInput: { flex: 1, fontFamily: 'RobotoMono_400Regular', fontSize: 16, color: '#425252', backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#e8e8e8', minWidth: 0 },
  itemCostInput: { flexShrink: 0, width: 80, fontFamily: 'RobotoMono_700Bold', fontSize: 16, color: '#425252', backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, borderColor: '#e8e8e8', textAlign: 'right' },
  sectionBlock: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  sectionBlockLabel: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  peopleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  personChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#e8e8e8', backgroundColor: '#ffffff' },
  personChipActive: { backgroundColor: '#0ccfcf', borderColor: '#0ccfcf' },
  personChipText: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#929090' },
  splitPreview: { fontFamily: 'RobotoMono_700Bold', fontSize: 11, color: '#0ccfcf', marginTop: 6 },
  subitemBlock: { marginBottom: 10 },
  subitemInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subArrow: { fontSize: 12, color: '#c0c0c0', flexShrink: 0 },
  subitemInput: { flex: 1, fontFamily: 'RobotoMono_400Regular', fontSize: 16, color: '#425252', backgroundColor: '#ffffff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#e8e8e8' },
  subitemCostHint: { fontFamily: 'RobotoMono_700Bold', fontSize: 10, color: '#0ccfcf', marginLeft: 2 },
  addSubLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  addSubLinkText: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#0ccfcf' },
  addItemLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 14, justifyContent: 'center' },
  addItemLinkText: { fontFamily: 'RobotoMono_400Regular', fontSize: 13, color: '#0ccfcf' },
  actions: { flexDirection: 'row', gap: 10, paddingVertical: 16 },
  cancelBtn: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
  cancelBtnText: { fontFamily: 'RobotoMono_700Bold', fontSize: 13, color: '#8a8a8a' },
  saveBtn: { flex: 1, backgroundColor: '#425252', borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
  saveBtnText: { fontFamily: 'RobotoMono_700Bold', fontSize: 13, color: '#fff' },
});
