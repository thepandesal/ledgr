import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  ActivityIndicator, TouchableOpacity, useWindowDimensions,
  Modal, TextInput,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../src/hooks/useUser';
import { useNav } from '../../src/lib/NavContext';
import { supabase } from '../../src/lib/supabase';
import { Colors, Radius } from '@/components/ui/theme';
import { AppFont } from '../../src/lib/fonts';
import { DC } from '../../src/lib/design';
import AnimatedIcon from '@/components/ui/AnimatedIcon';
import PageHeader from '@/components/ui/PageHeader';
import GooeyLoader from '@/components/ui/GooeyLoader';

const TEAL = '#5dc4bb';
const HEADER_TEAL = '#9cd7d2';
const POSITIVE = '#4f9289';
const NEGATIVE = '#ff5757';
const GAP = 12;

const ALL_ICONS = ["add-outline","adobe-after-effects-outline","adobe-experince-design-outline","adobe-illustrator-outline","adobe-indesign-outline","adobe-lightroom-outline","adobe-photoshop-outline","adobe-premiere-outline","alarm-outline","android-outline","app-store-outline","apple-outline","apps-outline","arrow-down-outline","arrow-left-outline","arrow-right-outline","arrow-up-outline","asana-outline","at-sign-outline","attach-outline","award-outline","backspace-outline","bag-outline","bank-outline","battery-empty-outline","battery-full-outline","battery-low-outline","battery-most-outline","battery-quarter-outline","battry-half-outline","behance-outline","binocular-outline","bluetooth-outline","book-check-outline","book-mark-outline","book-open-outline","book-outline","bookmark-outline","box-outline","bullhorn-outline","calendar-outline","camera-outline","cancel-outline","card-outline","caret-down-outline","caret-left-outline","caret-right-outline","caret-up-outline","chart-pie-alt-outline","chart-pie-outline","chat-outline","check-outline","checked-box-outline","chrome-outline","clipboard-alt-outline","clipboard-outline","clock-outline","cloud-check-outline","cloud-download-outline","cloud-off-outline","cloud-outline","cloud-upload-outline","collapse-outline","columns-outline","comment-block-outline","comment-minus-outline","comment-outline","comment-plus-outline","contacts-outline","copy-outline","cross-outline","current-location-outline","cursor-outline","desktop-outline","dialpad-outline","diamond-outline","dislike-outline","document-outline","download-outline","dribbble-outline","dropbox-outline","edit-alt-outline","edit-outline","envelope-open-outline","envelope-outline","exchange-outline","expand-outline","explore-outline","eye-closed-outline","eye-outline","facebook-messenger-outline","facebook-outline","fast-forward-outline","fast-rewind-outline","figma-outline","file-download-outline","file-outline","file-upload-outline","file-user-outline","filter-outline","flame-outline","flask-alt-outline","flask-outline","folder-block-outline","folder-delete-outline","folder-lock-outline","folder-open-outline","folder-outline","folder-plus-outline","folder-user-outline","forward-outline","gamepad-outline","globe-outline","gmail-outline","google-alt-outline","google-drive-outline","google-outline","google-play-outline","group-151-outline","headphone-outline","headset-outline","heart-off-outline","heart-outline","heart-plus-outline","heart-half-outline","history-outline","home-outline","hotspot-outline","image-outline","info-circle-outline","info-rect-outline","info-triangle-outline","instagram-outline","invoice-outline","key-outline","layout-outline","lightbulb-alt-outline","lightbulb-off-outline","lightbulb-outline","lightning-alt-outline","lightning-outline","like-outline","linkedin-outline","location-check-outline","location-outline","location-plus-outline","location-question-outline","lock-outline","lock-time-outline","login-outline","logout-outline","map-location-outline","medium-outline","medkit-outline","menu-outline","microphone-off-outline","microphone-outline","mobile-phone-outline","moon-outline","mouse-alt-outline","mouse-outline","move-outline","music-outline","navigate-outline","notification-off-outline","notification-on-outline","notification-outline","notion-outline","apps-outline","grid-outline","palette-outline","pause-outline","phone-in-outline","phone-miss-outline","phone-off-outline","phone-out-outline","phone-outline","picture-outline","pin-outline","pinterest-outline","play-outline","plus-outline","power-button-outline","present-outline","printer-outline","processor-outline","pulse-outline","qq-outline","reddit-outline","refresh-outline","reply-outline","rows-outline","sand-watch-outline","save-outline","search-outline","send-outline","server-outline","settings-adjust-outline","settings-alt-outline","settings-outline","share-box-outline","share-outline","shield-outline","bag-handle-outline","shopping-basket-outline","shopping-cart-outline","shuffle-outline","sketch-outline","skip-next-outline","skip-prev-outline","skype-outline","slack-outline","snapchat-outline","sort-outline","stack-outline","star-half-outline","star-outline","sunny-outline","telegram-outline","timer-outline","toggle-off-outline","toggle-on-outline","trash-alt-outline","trash-outline","trello-outline","tumblr-outline","twitch-outline","twitter-outline","umbrella-outline","university-outline","unlock-outline","upload-outline","user-block-outline","user-clock-outline","user-outline","user-plus-outline","viber-outline","video-outline","vk-outline","volume-down-outline","volume-off-outline","volume-up-outline","wallet-outline","watch-outline","whatsapp-outline","windows-outline","youtube-outline","zoom-in-outline","zoom-out-outline"];


const capitalize = (s: string) =>
  s.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());

interface Props {
  onClose: () => void;
}

export default function CategoriesPanel({ onClose }: Props) {
  const { userId, defaultCurrency } = useUser();
  const { openRecordingsPanel } = useNav();
  const { width: W } = useWindowDimensions();
  const queryClient = useQueryClient();
  const [monthOffset, setMonthOffset] = useState(0);

  // ── Category selection state ─────────────────────────────────────────
  const [selectedCat, setSelectedCat] = useState<{ id: string; name: string; icon: string } | null>(null);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editIconSearch, setEditIconSearch] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const filteredEditIcons = useMemo(() =>
    ALL_ICONS.filter(i => i.includes(editIconSearch.toLowerCase().replace(/\s+/g, '-'))),
    [editIconSearch]
  );

  const openChoice = (cat: any) => {
    setSelectedCat({ id: cat.id, name: cat.name, icon: cat.icon });
    setShowChoiceModal(true);
  };

  const [showDeleteCatModal, setShowDeleteCatModal] = useState(false);
  const [deletingCat, setDeletingCat] = useState(false);

  const handleDeleteCategory = async () => {
    if (!selectedCat?.id) return;
    if (selectedCat.name === 'Loans') return;
    setDeletingCat(true);
    await supabase.from('recordings').update({ category_id: null }).eq('category_id', selectedCat.id);
    await supabase.from('categories').delete().eq('id', selectedCat.id);
    setDeletingCat(false);
    setShowDeleteCatModal(false);
    setShowEditModal(false);
    queryClient.invalidateQueries({ queryKey: ['categories-panel', userId] });
    queryClient.invalidateQueries({ queryKey: ['categories', userId] });
  };

  const openEdit = () => {
    if (!selectedCat?.id) return;
    setEditName(selectedCat.name);
    setEditIcon(selectedCat.icon);
    setEditIconSearch('');
    setEditError('');
    setShowChoiceModal(false);
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!editName.trim() || !selectedCat?.id) return;
    const catId = selectedCat.id;
    setEditSaving(true);
    const { error } = await supabase.from('categories').update({
      name: editName.trim(), icon: editIcon,
    }).eq('id', catId);
    setEditSaving(false);
    if (error) { setEditError(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ['categories-panel', userId] });
    queryClient.invalidateQueries({ queryKey: ['categories', userId] });
    setShowEditModal(false);
  };

  // ── New category modal state ─────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('shopping-cart-outline');
  const [iconSearch, setIconSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [catError, setCatError] = useState('');

  const filteredIcons = useMemo(() =>
    ALL_ICONS.filter(i => i.includes(iconSearch.toLowerCase().replace(/\s+/g, '-'))),
    [iconSearch]
  );

  const handleSave = async () => {
    if (!catName.trim()) { setCatError('Name is required.'); return; }
    setSaving(true);
    const { error } = await supabase.from('categories').insert({
      user_id: userId, name: catName.trim(), icon: catIcon, color: '#B6E1DE', is_default: false,
    });
    setSaving(false);
    if (error) { setCatError(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ['categories-panel', userId] });
    queryClient.invalidateQueries({ queryKey: ['categories', userId] });
    setShowModal(false);
    setCatName(''); setCatIcon('shopping-cart-outline'); setIconSearch(''); setCatError('');
  };

  const { from, to, label } = useMemo(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const to   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()}`;
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return { from, to, label: `${months[d.getMonth()]} ${d.getFullYear()}` };
  }, [monthOffset]);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories-panel', userId, from],
    queryFn: async () => {
      // Fetch all user categories
      const { data: cats } = await supabase
        .from('categories')
        .select('id, name, icon, color')
        .eq('user_id', userId)
        .order('name');
      if (!cats || cats.length === 0) return [];

      // Fetch recordings for the selected month
      const { data: recs } = await supabase
        .from('recordings')
        .select('amount, type, category_id')
        .eq('user_id', userId)
        .in('type', ['expense', 'income', 'savings'])
        .neq('status', 'voided')
        .gte('transaction_date', from)
        .lte('transaction_date', to);

      const map: Record<string, { income: number; expense: number }> = {};
      (recs ?? []).forEach((r: any) => {
        const key = r.category_id ?? '__none__';
        if (!map[key]) map[key] = { income: 0, expense: 0 };
        if (r.type === 'income' || r.type === 'savings') map[key].income += Number(r.amount);
        else map[key].expense += Number(r.amount);
      });

      return cats.map((c: any) => ({
        id: c.id,
        name: c.name,
        icon: c.icon ?? 'apps-outline',
        color: c.color ?? '#B6E1DE',
        income: map[c.id]?.income ?? 0,
        expense: map[c.id]?.expense ?? 0,
      })).sort((a: any, b: any) => b.expense - a.expense);
    },
    enabled: !!userId,
  });

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ICON_COLS = 6;
  const iconBtnSize = Math.floor((W - DC.pagePadding * 2 - 8 * (ICON_COLS - 1)) / ICON_COLS);
  const cardW = (W - DC.pagePadding * 2 - GAP) / 2;

  return (
    <SafeAreaView style={s.root}>
      <PageHeader title="Categories" onBack={onClose} titleColor={HEADER_TEAL} />

      {/* Month + New Category buttons */}
      <View style={s.btnRow}>
        <View style={[s.actionBtn, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
          <TouchableOpacity onPress={() => setMonthOffset(o => o - 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={13} color={DC.pageActionText} />
          </TouchableOpacity>
          <Text style={s.actionBtnText}>{label}</Text>
          <TouchableOpacity onPress={() => setMonthOffset(o => o + 1)} disabled={monthOffset >= 0} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-forward" size={13} color={monthOffset >= 0 ? Colors.faint : DC.pageActionText} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[s.actionBtn, { flex: 1 }]} activeOpacity={0.7} onPress={() => { setCatName(''); setCatIcon('shopping-cart-outline'); setIconSearch(''); setCatError(''); setShowModal(true); }}>
          <Text style={s.actionBtnText}>New Category</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <GooeyLoader />
        </BlurView>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.grid}>
            {categories.map((cat, i) => {
              const net = cat.income - cat.expense;
              const isPositive = net >= 0;
              return (
                <TouchableOpacity key={i} style={[s.card, { width: cardW }]} activeOpacity={0.7} onPress={() => openChoice(cat)}>
                  <View style={s.iconWrap}>
                    <AnimatedIcon set="basil" icon={cat.icon} size={22} color="#111111" />
                  </View>
                  <View style={s.cardRight}>
                    <Text style={s.catName} numberOfLines={1} ellipsizeMode="tail">{capitalize(cat.name)}</Text>
                    <Text style={[s.catAmount, isPositive ? s.amountPositive : s.amountNegative]}>
                      {fmt(Math.abs(net))}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* ── Choice Modal ── */}
      <Modal visible={showChoiceModal} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setShowChoiceModal(false)}>
        <TouchableOpacity style={m.choiceOverlay} activeOpacity={1} onPress={() => setShowChoiceModal(false)}>
          <View style={m.choiceBox}>
            <Text style={m.choiceTitle}>{selectedCat?.name}</Text>
            <TouchableOpacity style={m.choiceRow} activeOpacity={0.7} onPress={openEdit}>
              <Ionicons name="create-outline" size={18} color={DC.pageText} />
              <Text style={m.choiceRowText}>Edit Category</Text>
            </TouchableOpacity>
            <TouchableOpacity style={m.choiceRow} activeOpacity={0.7} onPress={() => {
              setShowChoiceModal(false);
              if (selectedCat) openRecordingsPanel({ categoryId: selectedCat.id, categoryName: selectedCat.name });
            }}>
              <Ionicons name="list-outline" size={18} color={DC.pageText} />
              <Text style={m.choiceRowText}>View Recordings</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Edit Category Modal ── */}
      <Modal visible={showEditModal} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setShowEditModal(false)}>
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
        <View style={m.overlay}>
          <SafeAreaView style={m.sheet}>
            <View style={m.inner}>
              <View style={m.header}>
                <Text style={m.title}>Edit Category</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setShowDeleteCatModal(true)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: '#FF575722' }}
                  >
                    <Text style={{ fontFamily: AppFont.semiBold, fontSize: 12, color: '#FF5757' }}>Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowEditModal(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <View style={m.closeBtn}><Text style={m.closeBtnText}>✕</Text></View>
                  </TouchableOpacity>
                </View>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
                {editError ? <Text style={m.error}>{editError}</Text> : null}
                <View style={m.field}>
                  <Text style={m.label}>Preview</Text>
                  <View style={m.preview}>
                    <AnimatedIcon set="basil" icon={editIcon} size={18} color="#111111" />
                    <Text style={m.previewText}>{editName || 'my category'}</Text>
                  </View>
                </View>
                <View style={m.field}>
                  <Text style={m.label}>Category Name</Text>
                  <TextInput style={m.input} placeholder="e.g. Groceries" placeholderTextColor={Colors.faint} value={editName} onChangeText={v => { setEditName(v); setEditError(''); }} autoFocus />
                </View>
                <View style={m.field}>
                  <Text style={m.label}>Icon</Text>
                  <View style={m.searchRow}>
                    <Ionicons name="search-outline" size={14} color={Colors.faint} />
                    <TextInput style={m.searchInput} placeholder="search icons..." placeholderTextColor={Colors.faint} value={editIconSearch} onChangeText={setEditIconSearch} />
                  </View>
                  <View style={[m.iconGrid, { gap: 8 }]}>
                    {filteredEditIcons.map(icon => (
                      <TouchableOpacity key={icon} style={[m.iconBtn, { width: iconBtnSize, height: iconBtnSize }, editIcon === icon && m.iconBtnActive]} onPress={() => setEditIcon(icon)} activeOpacity={0.7}>
                        <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                          <AnimatedIcon set="basil" icon={icon} size={20} color="#111111" />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <TouchableOpacity style={[m.saveBtn, (!editName.trim() || editSaving) && { opacity: 0.4 }]} onPress={handleEditSave} disabled={editSaving || !editName.trim()} activeOpacity={0.8}>
                  {editSaving ? <ActivityIndicator color="#ffffff" /> : <Text style={m.saveBtnText}>Save Changes</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── New Category Modal ── */}
      <Modal visible={showModal} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setShowModal(false)}>
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
        <View style={m.overlay}>
          <SafeAreaView style={m.sheet}>
            <View style={m.inner}>
              <View style={m.header}>
                <Text style={m.title}>New Category</Text>
                <TouchableOpacity onPress={() => setShowModal(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <View style={m.closeBtn}><Text style={m.closeBtnText}>✕</Text></View>
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
                {catError ? <Text style={m.error}>{catError}</Text> : null}
                <View style={m.field}>
                  <Text style={m.label}>Preview</Text>
                  <View style={m.preview}>
                    <AnimatedIcon set="basil" icon={catIcon} size={18} color="#111111" />
                    <Text style={m.previewText}>{catName || 'my category'}</Text>
                  </View>
                </View>
                <View style={m.field}>
                  <Text style={m.label}>Category Name</Text>
                  <TextInput style={m.input} placeholder="e.g. Groceries" placeholderTextColor={Colors.faint} value={catName} onChangeText={v => { setCatName(v); setCatError(''); }} autoFocus />
                </View>
                <View style={m.field}>
                  <Text style={m.label}>Icon</Text>
                  <View style={m.searchRow}>
                    <Ionicons name="search-outline" size={14} color={Colors.faint} />
                    <TextInput style={m.searchInput} placeholder="search icons..." placeholderTextColor={Colors.faint} value={iconSearch} onChangeText={setIconSearch} />
                  </View>
                  <View style={[m.iconGrid, { gap: 8 }]}>
                    {filteredIcons.map(icon => (
                      <TouchableOpacity key={icon} style={[m.iconBtn, { width: iconBtnSize, height: iconBtnSize }, catIcon === icon && m.iconBtnActive]} onPress={() => setCatIcon(icon)} activeOpacity={0.7}>
                        <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                          <AnimatedIcon set="basil" icon={icon} size={20} color="#111111" />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <TouchableOpacity style={[m.saveBtn, (!catName.trim() || saving) && { opacity: 0.4 }]} onPress={handleSave} disabled={saving || !catName.trim()} activeOpacity={0.8}>
                  {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={m.saveBtnText}>Add Category</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
      {/* ── Delete Category Confirmation ── */}
      {showDeleteCatModal && (
        <View style={m.confirmOverlay}>
          <View style={m.confirmBox}>
            <Text style={m.confirmTitle}>Delete "{selectedCat?.name}"?</Text>
            <Text style={m.confirmBody}>
              All recordings under this category will be moved to Uncategorized. This cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity
                style={[m.confirmBtn, { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }]}
                onPress={() => setShowDeleteCatModal(false)}
                activeOpacity={0.8}
              >
                <Text style={{ fontFamily: AppFont.semiBold, fontSize: 14, color: Colors.muted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.confirmBtn, { backgroundColor: '#FF5757', opacity: deletingCat ? 0.5 : 1 }]}
                onPress={handleDeleteCategory}
                disabled={deletingCat}
                activeOpacity={0.8}
              >
                <Text style={{ fontFamily: AppFont.semiBold, fontSize: 14, color: '#ffffff' }}>
                  {deletingCat ? 'Deleting...' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: DC.pagePadding, paddingBottom: 80, paddingTop: 16 },

  btnRow:      { flexDirection: 'row', gap: 8, paddingHorizontal: DC.pagePadding, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  actionBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: DC.pageActionPaddingH, paddingVertical: DC.pageActionPaddingV, borderRadius: DC.pageActionRadius, backgroundColor: DC.pageActionBg, borderWidth: DC.pageActionBorderWidth },
  actionBtnText:{ fontFamily: AppFont.regular, fontSize: DC.dropdownFontSize, color: DC.pageActionText },

  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyText: { fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#eeeeee',
    borderRadius: 12,
    padding: 12,
  },
  iconWrap:  { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  cardRight: { flex: 1, gap: 3 },
  catName:   { fontFamily: AppFont.bold, fontSize: 11, color: '#111111' },
  catAmount: { fontSize: 11 },
  amountPositive: { fontFamily: AppFont.bold,    color: POSITIVE },
  amountNegative: { fontFamily: AppFont.regular, color: NEGATIVE },
});

const m = StyleSheet.create({
  choiceOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  choiceBox:     { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: 20, width: '100%', gap: 4 },
  choiceTitle:   { fontFamily: AppFont.bold, fontSize: 16, color: '#111111', marginBottom: 8 },
  choiceRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  choiceRowText: { fontFamily: AppFont.regular, fontSize: 15, color: DC.pageText },

  overlay: { flex: 1 },
  sheet:   { flex: 1, backgroundColor: 'rgba(255,255,255,0.88)' },
  inner:   { flex: 1, paddingHorizontal: DC.pagePadding, paddingTop: 16 },

  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16 },
  title:        { fontFamily: AppFont.bold, fontSize: 22, color: HEADER_TEAL, letterSpacing: -0.5 },
  closeBtn:     { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontFamily: AppFont.bold, fontSize: 14, color: DC.pageText },

  error: { fontFamily: AppFont.regular, fontSize: 12, color: NEGATIVE },

  field: { gap: 8 },
  label: { fontFamily: AppFont.semiBold, fontSize: 11, color: DC.pageTextMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: { fontFamily: AppFont.regular, fontSize: 16, color: DC.pageText, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderMid },

  searchRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.borderMid, marginBottom: 10 },
  searchInput:{ flex: 1, fontFamily: AppFont.regular, fontSize: 14, color: DC.pageText },
  iconGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconBtn:    { borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  iconBtnActive: { backgroundColor: '#ebf7f6' },

  preview:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.pill, paddingVertical: 14, paddingHorizontal: 16 },
  previewText: { fontFamily: AppFont.bold, fontSize: 14, color: '#111111' },

  saveBtn:     { backgroundColor: DC.btnBg, borderRadius: Radius.pill, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { fontFamily: AppFont.semiBold, fontSize: 15, color: DC.btnText },
  confirmOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24, zIndex: 999 },
  confirmBox:     { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: 24, width: '100%' },
  confirmTitle:   { fontFamily: AppFont.bold, fontSize: 16, color: '#111111', marginBottom: 8 },
  confirmBody:    { fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted, lineHeight: 20 },
  confirmBtn:     { flex: 1, paddingVertical: 12, borderRadius: Radius.pill, alignItems: 'center' },
});
