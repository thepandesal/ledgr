import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts } from '../components/ui/theme';
import { Brand } from '../src/lib/brand';

const LAST_UPDATED = 'June 2025';

const PRIVACY = `
Ledgr ("we", "our", or "us") is committed to protecting your privacy. This policy explains what data we collect, how we use it, and your rights.

1. DATA WE COLLECT
• Account information: your name and email address provided via Google or Apple Sign-In.
• Financial recordings: expenses, income, debts, and other entries you create.
• Receipt photos: images you upload, stored securely on Cloudflare R2.
• Usage data: basic app activity to improve performance.

2. HOW WE USE YOUR DATA
• To provide and operate the Ledgr service.
• To sync your data across your devices.
• To send you notifications you have enabled (due dates, reminders).
• We do not sell your data to third parties. Ever.

3. DATA STORAGE
• Your data is stored on Supabase (PostgreSQL) servers.
• Receipt photos are stored on Cloudflare R2 (cdn.ledgr.art).
• All data is encrypted in transit (HTTPS/TLS).

4. DATA SHARING
• We do not share your personal financial data with any third party.
• Split bill share links are intentionally public — only share them with people you trust.
• We use Supabase Auth for authentication (Google, Apple). Their privacy policies apply.

5. DATA RETENTION
• Your data is retained as long as your account is active.
• You may request deletion of your account and all associated data by contacting us.

6. YOUR RIGHTS
• Access: you can export your recordings via the CSV export feature.
• Deletion: contact us to permanently delete your account and data.
• Correction: you can edit or delete any recording at any time within the app.

7. CHILDREN
Ledgr is not intended for users under 13 years of age.

8. CHANGES
We may update this policy. We will notify you of significant changes via the app.

9. CONTACT
For privacy concerns: support@ledgr.art
`;

const TERMS = `
By using Ledgr, you agree to these Terms of Service. Please read them carefully.

1. ACCEPTANCE
By creating an account, you agree to be bound by these terms and our Privacy Policy.

2. YOUR ACCOUNT
• You are responsible for maintaining the security of your account.
• You must provide accurate information when creating your account.
• You may not use Ledgr for any illegal or unauthorized purpose.

3. THE SERVICE
• Ledgr is a personal finance tracking tool. It is not a bank, financial advisor, or payment processor.
• We do not guarantee the accuracy of any currency conversions or financial calculations.
• The service is provided "as is" without warranties of any kind.

4. FREE AND PREMIUM TIERS
• The free tier includes core features with certain limits (e.g. 10 receipt photo uploads per month).
• Premium features may be introduced in the future with a subscription fee.
• We reserve the right to modify free tier limits with reasonable notice.

5. USER CONTENT
• You own all financial data and content you create in Ledgr.
• By using the service, you grant us a limited license to store and process your data solely to provide the service.
• You are responsible for the accuracy of your own financial records.

6. PROHIBITED USE
You may not:
• Attempt to reverse engineer or compromise the security of the app.
• Use the service to store or transmit illegal content.
• Share your account credentials with others.

7. SPLIT BILL SHARE LINKS
• Share links are publicly accessible by anyone with the URL.
• Do not include sensitive personal information in recording names that you intend to share.

8. LIMITATION OF LIABILITY
Ledgr is not liable for any financial decisions made based on data recorded in the app. Always consult a qualified financial advisor for financial decisions.

9. TERMINATION
We reserve the right to suspend or terminate accounts that violate these terms.

10. CHANGES
We may update these terms. Continued use of the app after changes constitutes acceptance.

11. CONTACT
For questions: support@ledgr.art
`;

export default function LegalScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const showPrivacy = tab !== 'terms';

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <View style={s.header}>

        <Text style={s.title}>{showPrivacy ? 'privacy policy' : 'terms of service'}</Text>
        <View style={{ width: 20 }} />
      </View>

      {/* Tab switcher */}
      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tab, showPrivacy && s.tabActive]}
          onPress={() => router.setParams({ tab: 'privacy' })}
          activeOpacity={0.75}
        >
          <Text style={[s.tabText, showPrivacy && s.tabTextActive]}>privacy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, !showPrivacy && s.tabActive]}
          onPress={() => router.setParams({ tab: 'terms' })}
          activeOpacity={0.75}
        >
          <Text style={[s.tabText, !showPrivacy && s.tabTextActive]}>terms</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.updated}>last updated: {LAST_UPDATED}</Text>
        <Text style={s.body}>{showPrivacy ? PRIVACY.trim() : TERMS.trim()}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:     { fontFamily: 'ChillaxMedium', fontSize: 16, color: Colors.text },
  tabs:      { flexDirection: 'row', paddingHorizontal: 24, paddingTop: 16, gap: 8 },
  tab:       { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.input },
  tabActive: { backgroundColor: Brand.color.accent },
  tabText:   { fontFamily: 'ChillaxRegular', fontSize: 13, color: Colors.muted },
  tabTextActive: { fontFamily: 'ChillaxMedium', fontSize: 13, color: Colors.text },
  scroll:    { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
  updated:   { fontFamily: 'DMSans_400Regular', fontSize: 11, color: Colors.muted, marginBottom: 16 },
  body:      { fontFamily: 'DMSans_400Regular', fontSize: 13, color: Colors.text, lineHeight: 22 },
});
