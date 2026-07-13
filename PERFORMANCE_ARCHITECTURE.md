# Ledgr — Performance & Architecture Review
**Prepared for:** Architect / Senior Developer  
**Prepared by:** Technical Review (Amazon Q)  
**Scope:** Database query efficiency, data fetching patterns, image upload performance, date handling, and general app performance

---

## Table of Contents
1. [Tech Stack Overview](#1-tech-stack-overview)
2. [Current Data Fetching Architecture](#2-current-data-fetching-architecture)
3. [Critical Issues](#3-critical-issues)
4. [Medium Priority Issues](#4-medium-priority-issues)
5. [Minor Issues](#5-minor-issues)
6. [Recommended Supabase Index Strategy](#6-recommended-supabase-index-strategy)
7. [Date Handling Standard](#7-date-handling-standard)
8. [Image Upload Pipeline](#8-image-upload-pipeline)
9. [Cleanup Tasks](#9-cleanup-tasks)
10. [Implementation Priority Order](#10-implementation-priority-order)

---

## 1. Tech Stack Overview

| Layer | Technology |
|-------|-----------|
| Framework | Expo (React Native + Web via expo-router) |
| Database | Supabase (PostgreSQL) |
| File Storage | Supabase Storage (web) + Cloudflare R2 (native) |
| Data Fetching | TanStack React Query v5 |
| Auth | Supabase Auth |
| OCR | Tesseract.js (web only) |
| Notifications | Expo Notifications |

**React Query global config** (`app/_layout.tsx`):
```ts
staleTime: 1000 * 60 * 5   // 5 min cache
gcTime:    1000 * 60 * 30  // 30 min garbage collection
retry: 2
```

---

## 2. Current Data Fetching Architecture

### What's working well
- React Query is used consistently across all tab screens for caching
- `Promise.all` is used in some places to parallelize independent queries
- Exchange rates are cached for 1 hour (`staleTime: 1000 * 60 * 60`)
- User settings use `staleTime: Infinity` in the spaces screen
- Pagination (infinite scroll) is implemented in receipts and bill-split screens

### What needs fixing
The main problems are N+1 query patterns, missing query caching in the `useUser` hook, unnecessary full-table scans, and sequential operations that should be parallel. Each is detailed below.

---

## 3. Critical Issues

---

### Issue 1 — N+1 Query Pattern in Receipts Screen
**File:** `app/(app)/(tabs)/receipts.tsx`  
**Severity:** Critical  
**Impact:** With 50 receipt entries, this fires 100+ DB calls on every screen load

**Current code:**
```ts
const full: Entry[] = await Promise.all(data.map(async (e: any) => {
  // Query 1: fetch photos for each entry
  const { data: photos, count } = await supabase
    .from('receipt_photos')
    .select('storage_path, url', { count: 'exact' })
    .eq('entry_id', e.id)
    .order('created_at')
    .limit(1);

  // Query 2: fetch linked recording for each entry
  if (e.recording_id) {
    const { data: rec } = await supabase
      .from('recordings')
      .select('name, type')
      .eq('id', e.recording_id)
      .single();
  }
}));
```

**Problem:** For every receipt entry, 2 separate DB queries are fired. This is an N+1 pattern.

**Fix — use Supabase foreign key joins:**
```ts
const { data } = await supabase
  .from('receipt_entries')
  .select(`
    *,
    receipt_photos(storage_path, url),
    recordings(name, type)
  `)
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```
This reduces N+1 queries down to **1 query** regardless of how many entries exist. Then compute `photoCount` and `firstPhoto` client-side from the joined data.

---

### Issue 2 — N+1 Query Pattern in Bill Split Screen
**File:** `app/(app)/(tabs)/bill-split.tsx`  
**Severity:** Critical  
**Impact:** With 20 split bills, this fires 60+ DB calls on every load

**Current code:**
```ts
const enriched = await Promise.all(data.map(async (bill: any) => {
  const [{ count: recCount }, { data: people }, { data: recs }] = await Promise.all([
    supabase.from('split_bill_recordings').select('id', { count: 'exact', head: true }).eq('split_bill_id', bill.id),
    supabase.from('bill_splits').select('person_name').eq('split_bill_id', bill.id),
    supabase.from('split_bill_recordings').select('amount_contributed').eq('split_bill_id', bill.id),
  ]);
}));
```

**Problem:** 3 queries per bill, fired for every bill in the list.

**Fix — Option A: Supabase RPC (recommended)**

Create a Postgres function:
```sql
CREATE OR REPLACE FUNCTION get_split_bill_summaries(p_user_id uuid)
RETURNS TABLE (
  id uuid, name text, created_at timestamptz, status text,
  recording_count bigint, people_count bigint, total_amount numeric
) AS $$
  SELECT
    sb.id, sb.name, sb.created_at, sb.status,
    COUNT(DISTINCT sbr.id) AS recording_count,
    COUNT(DISTINCT bs.person_name) AS people_count,
    COALESCE(SUM(sbr.amount_contributed), 0) AS total_amount
  FROM split_bills sb
  LEFT JOIN split_bill_recordings sbr ON sbr.split_bill_id = sb.id
  LEFT JOIN bill_splits bs ON bs.split_bill_id = sb.id
  WHERE sb.user_id = p_user_id
  GROUP BY sb.id, sb.name, sb.created_at, sb.status
  ORDER BY sb.created_at DESC;
$$ LANGUAGE sql STABLE;
```

Then call it:
```ts
const { data } = await supabase.rpc('get_split_bill_summaries', { p_user_id: userId });
```
This reduces 60+ queries to **1 query**.

**Fix — Option B: Client-side aggregation**

Fetch all data in 3 flat queries (not per-bill), then aggregate client-side:
```ts
const [{ data: bills }, { data: allRecordings }, { data: allPeople }] = await Promise.all([
  supabase.from('split_bills').select('id, name, created_at, status').eq('user_id', userId).order('created_at', { ascending: false }),
  supabase.from('split_bill_recordings').select('split_bill_id, amount_contributed').in('split_bill_id', billIds),
  supabase.from('bill_splits').select('split_bill_id, person_name').in('split_bill_id', billIds),
]);
// Then aggregate client-side using reduce/Map
```
This reduces 60+ queries to **3 queries**.

---

### Issue 3 — Full Table Scan for All-Time Recordings in Spaces Screen
**File:** `app/(app)/(tabs)/spaces.tsx`  
**Severity:** Critical  
**Impact:** Fetches every income/expense recording ever created with no limit. Gets slower as user data grows indefinitely.

**Current code:**
```ts
const { data: allTimeRecs } = await supabase
  .from('recordings')
  .select('space_id, amount, type, currency')
  .eq('user_id', userId)
  .in('type', ['income', 'expense']);
// Then loops over all records to compute per-space totals
```

**Fix — use Supabase aggregate query:**
```ts
// Replace the full scan with a server-side sum grouped by space_id and type
const { data: allTimeSums } = await supabase
  .from('recordings')
  .select('space_id, type, amount')
  .eq('user_id', userId)
  .in('type', ['income', 'expense'])
  .not('status', 'eq', 'voided');
```

Or better, create a Postgres view or RPC:
```sql
CREATE OR REPLACE FUNCTION get_space_all_time_totals(p_user_id uuid)
RETURNS TABLE (space_id uuid, income_total numeric, expense_total numeric) AS $$
  SELECT
    space_id,
    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income_total,
    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense_total
  FROM recordings
  WHERE user_id = p_user_id AND type IN ('income', 'expense') AND status != 'voided'
  GROUP BY space_id;
$$ LANGUAGE sql STABLE;
```

---

### Issue 4 — `useUser` Hook Re-fetches on Every Component Mount
**File:** `src/hooks/useUser.ts`  
**Severity:** Critical  
**Impact:** Every screen that calls `useUser()` fires a fresh `supabase.from('user_settings')` query. Since it uses plain `useState`/`useEffect` (not React Query), there is no caching — it re-fetches on every mount.

**Current code:**
```ts
useEffect(() => {
  if (!user?.id) return;
  supabase
    .from('user_settings')
    .select('profile_code, default_currency')
    .eq('user_id', user.id)
    .maybeSingle()
    .then(async ({ data }) => {
      // sets state...
    });
}, [user?.id]);
```

**Fix — wrap in React Query:**
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Inside useUser():
const { data: settings } = useQuery({
  queryKey: ['user-settings', user?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from('user_settings')
      .select('profile_code, default_currency')
      .eq('user_id', user!.id)
      .maybeSingle();
    return data;
  },
  enabled: !!user?.id,
  staleTime: Infinity,  // user settings rarely change
});

const defaultCurrency = settings?.default_currency ?? 'PHP';
const profileCode = settings?.profile_code ?? '';
```

This means the settings query fires **once per session** and is shared across all components that call `useUser()`.

---

## 4. Medium Priority Issues

---

### Issue 5 — Signed URLs Regenerated on Every Screen Visit
**File:** `app/(app)/receipt-detail.tsx`  
**Severity:** Medium  
**Impact:** Slow receipt detail load, unnecessary Supabase Storage API calls

**Current code:**
```ts
const withUrls = await Promise.all(rows.map(async (p: any) => {
  let url = p.url ?? '';
  if (!url && p.storage_path) {
    // Generates a new signed URL every time the screen is opened
    const { data } = await supabase.storage
      .from('receipts')
      .createSignedUrl(p.storage_path, 3600);
    url = data?.signedUrl ?? '';
  }
  return { id: p.id, url, path: p.storage_path };
}));
```

**Root cause:** The `url` column in `receipt_photos` is sometimes empty. This happens when the upload path doesn't store the public URL.

**Fix:**
1. Ensure `uploadReceiptPhoto` in `receiptUpload.ts` always writes a non-empty `url` to the DB. It already does this — verify the `url` column is never null after upload.
2. Remove the signed URL fallback entirely once confirmed. Signed URLs expire and cause broken images after 1 hour anyway.
3. For R2 uploads, `publicUrl` is already a permanent public URL. For Supabase Storage uploads, use `getPublicUrl()` instead of `createSignedUrl()` if the bucket is public, or store the signed URL with a long TTL (e.g., 1 year) at upload time — which `receiptUpload.ts` already does (`3600 * 24 * 365`).

---

### Issue 6 — Recording Detail Screen Fires 7+ Sequential DB Calls on Mount
**File:** `app/(app)/recording-detail.tsx`  
**Severity:** Medium  
**Impact:** Slow initial load of recording detail screen

**Current code:**
```ts
useEffect(() => {
  loadRecording();       // sequential
  loadContacts();        // sequential
  loadPeople();          // sequential
  loadItems();           // sequential
  loadLinkedReceipt();   // sequential
  loadPaymentData();     // sequential (depends on recording type)
  loadLinkedSplitBill(); // sequential
  supabase.from('split_shares')... // sequential
}, []);
```

**Fix — parallelize independent calls:**
```ts
useEffect(() => {
  // These are all independent — run in parallel
  Promise.all([
    loadRecording(),
    loadContacts(),
    loadPeople(),
    loadItems(),
    loadLinkedReceipt(),
    loadLinkedSplitBill(),
    supabase.from('split_shares').select('id').eq('recording_id', recordingId).maybeSingle()
      .then(({ data }) => { if (data) setShareRowId(data.id); }),
  ]).then(() => {
    // loadPaymentData depends on recording type — run after loadRecording resolves
    loadPaymentData();
  });
}, []);
```

This reduces perceived load time significantly since all independent queries run concurrently.

---

### Issue 7 — Dashboard Re-fetches When Exchange Rates Load
**File:** `app/(app)/(tabs)/dashboard.tsx`  
**Severity:** Medium  
**Impact:** Dashboard flickers/reloads after exchange rates come in, causing a double render

**Current code:**
```ts
const { data: recordings = [], isLoading } = useQuery({
  queryKey: ['dashboard-activities', userId, Object.keys(rateMap).length, defaultCurrency],
  // ...
});
```

**Problem:** `Object.keys(rateMap).length` changes from `0` to a non-zero value when exchange rates load, invalidating the query key and triggering a full re-fetch of all recordings — even though the recordings themselves haven't changed. Currency conversion happens client-side.

**Fix — remove `rateMap` from the query key:**
```ts
const { data: recordings = [], isLoading } = useQuery({
  queryKey: ['dashboard-activities', userId],
  // ...
});
```

The `convert()` function from `useExchangeRates` is called during rendering, not during the query. The recordings data doesn't need to be re-fetched when rates change.

Apply the same fix to `spaces.tsx`:
```ts
// Before
queryKey: ['spaces', userId, dateMode, dateOffset, weekStart, useCutoff, cutoffDay, Object.keys(rateMap).length, defaultCurrency],

// After
queryKey: ['spaces', userId, dateMode, dateOffset, weekStart, useCutoff, cutoffDay],
```

---

### Issue 8 — Multi-Photo Upload is Sequential
**Files:** `app/(app)/(tabs)/receipts.tsx`, `app/(app)/receipt-detail.tsx`  
**Severity:** Medium  
**Impact:** Uploading 5 photos takes 5x as long as it needs to

**Current code:**
```ts
for (const asset of result.assets) {
  const compressed = await compressImage(asset.uri);
  await uploadReceiptPhoto(compressed, activeEntryId);
}
```

**Fix — parallelize with a concurrency limit:**
```ts
const CONCURRENCY = 3; // avoid overwhelming the connection

const uploadBatch = async (assets: typeof result.assets) => {
  for (let i = 0; i < assets.length; i += CONCURRENCY) {
    const batch = assets.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (asset) => {
      const compressed = await compressImage(asset.uri);
      const uploaded = await uploadReceiptPhoto(compressed, activeEntryId);
      if (uploaded) setPhotos(prev => [...prev, uploaded]);
    }));
  }
};

await uploadBatch(result.assets);
```

---

## 5. Minor Issues

---

### Issue 9 — Supabase Client Has No Production Config
**File:** `src/lib/supabase.ts`  
**Severity:** Low

**Current code:**
```ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Fix — add production-appropriate config:**
```ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // set true only if using OAuth redirects
  },
  realtime: {
    params: {
      eventsPerSecond: 2, // throttle realtime events to reduce noise
    },
  },
  global: {
    headers: {
      'x-app-version': '1.0.0', // useful for debugging in Supabase logs
    },
  },
});
```

---

### Issue 10 — Inconsistent Date Parsing (Timezone Bug)
**Files:** Multiple screens  
**Severity:** Medium  
**Impact:** Dates can display as one day off depending on the user's timezone

**Problem:** `new Date('2024-01-15')` parses as UTC midnight (`2024-01-15T00:00:00Z`). In UTC+8 (Philippines), this renders as `Jan 14` because UTC midnight is 8 hours behind local time.

**Current inconsistent usage:**
```ts
// Some places do this correctly (safe):
const [y, m, d] = r.transaction_date.split('-').map(Number);
const date = new Date(y, m - 1, d); // local time ✅

// Other places do this incorrectly (timezone bug):
new Date(recording.transaction_date) // UTC parse ❌
new Date(d).toLocaleDateString(...)  // UTC parse ❌
```

**Fix — create and use a shared utility:**

Add to `src/lib/dateUtils.ts`:
```ts
/**
 * Safely parses a YYYY-MM-DD string as a local date (not UTC).
 * Use this everywhere instead of new Date(dateString).
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Formats a YYYY-MM-DD string for display.
 */
export function formatDisplayDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
```

Then replace all instances of `new Date(someYYYYMMDDString)` with `parseLocalDate(someYYYYMMDDString)` across the codebase.

**Files to audit for this fix:**
- `app/(app)/recording-detail.tsx` — `formatDate()` function
- `app/(app)/receipt-detail.tsx` — `formatDate()` function
- `app/(app)/(tabs)/receipts.tsx` — `formatDate()` function
- `app/(app)/(tabs)/bill-split.tsx` — date grouping logic
- `app/(app)/(tabs)/reminders.tsx` — start/end date parsing

---

## 6. Recommended Supabase Index Strategy

The following indexes should be added to the Supabase database to support the query patterns used in the app. Run these in the Supabase SQL editor.

```sql
-- recordings: most queries filter by user_id + transaction_date
CREATE INDEX IF NOT EXISTS idx_recordings_user_date
  ON recordings(user_id, transaction_date DESC);

-- recordings: space-based queries
CREATE INDEX IF NOT EXISTS idx_recordings_user_space
  ON recordings(user_id, space_id);

-- recordings: type filtering
CREATE INDEX IF NOT EXISTS idx_recordings_user_type
  ON recordings(user_id, type);

-- recordings: linked recording lookups (payment chains)
CREATE INDEX IF NOT EXISTS idx_recordings_linked
  ON recordings(linked_recording_id)
  WHERE linked_recording_id IS NOT NULL;

-- receipt_photos: entry lookups
CREATE INDEX IF NOT EXISTS idx_receipt_photos_entry
  ON receipt_photos(entry_id, created_at);

-- receipt_entries: user lookups
CREATE INDEX IF NOT EXISTS idx_receipt_entries_user
  ON receipt_entries(user_id, created_at DESC);

-- receipt_entries: recording link lookups
CREATE INDEX IF NOT EXISTS idx_receipt_entries_recording
  ON receipt_entries(recording_id)
  WHERE recording_id IS NOT NULL;

-- split_bill_recordings: bill lookups
CREATE INDEX IF NOT EXISTS idx_split_bill_recordings_bill
  ON split_bill_recordings(split_bill_id);

-- bill_splits: bill lookups
CREATE INDEX IF NOT EXISTS idx_bill_splits_bill
  ON bill_splits(split_bill_id);

-- recording_reminders: user + status
CREATE INDEX IF NOT EXISTS idx_reminders_user_status
  ON recording_reminders(user_id, status);

-- split_items: recording lookups
CREATE INDEX IF NOT EXISTS idx_split_items_recording
  ON split_items(recording_id);

-- split_subitems: item lookups
CREATE INDEX IF NOT EXISTS idx_split_subitems_item
  ON split_subitems(item_id);

-- recording_breakdowns: recording lookups
CREATE INDEX IF NOT EXISTS idx_recording_breakdowns_recording
  ON recording_breakdowns(recording_id);

-- space_members: user + status
CREATE INDEX IF NOT EXISTS idx_space_members_user_status
  ON space_members(user_id, status);
```

---

## 7. Date Handling Standard

### The Problem
`YYYY-MM-DD` strings from the database must **never** be passed directly to `new Date()`. JavaScript parses them as UTC midnight, which shifts the date by the user's UTC offset.

### The Standard
All date parsing in this codebase must use `parseLocalDate()` from `src/lib/dateUtils.ts` (see Issue 10 fix above).

### Date Range Queries to Supabase
When filtering by date range, always convert to `YYYY-MM-DD` strings in **local time** before sending to Supabase. The app already does this correctly in `spaces.tsx`:
```ts
const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
```
This pattern should be used consistently everywhere. Do **not** use `.toISOString().split('T')[0]` as that converts to UTC first.

### Existing `dateUtils.ts` Functions
These are already implemented and should be used:

| Function | Purpose |
|----------|---------|
| `getDateRange(mode, offset, weekStart, useCutoff, cutoffDay)` | Returns `{ from, to }` Date objects for a given mode |
| `getDateLabel(mode, offset, weekStart, useCutoff, cutoffDay)` | Returns a human-readable label for the date range |

Supported modes: `monthly`, `weekly`, `daily`, `yearly`, `custom`

---

## 8. Image Upload Pipeline

### Current Flow

```
User picks image (camera or gallery)
  → compressImage() — resize to max 900px wide, JPEG 65% quality
  → uploadReceiptPhoto()
      → Web: uploadToSupabase() → Supabase Storage → createSignedUrl (1 year TTL)
      → Native: uploadToR2() → Cloudflare R2 → permanent public URL
  → Insert row into receipt_photos (entry_id, storage_path, url)
```

### Security Controls Already in Place
- `isSafeUrl()` validates URLs against an allowlist before any network request
- `blob:` URIs read via `XMLHttpRequest` (browser-sandboxed, no network)
- `data:` URIs decoded manually from base64 (no network)
- `publicUrl` validated with `isSafeUrl()` before DB insert
- Monthly upload limit: 10 photos per user per calendar month (enforced in `getMonthlyReceiptCount`)

### Known Issue — Signed URL Expiry
Supabase Storage signed URLs expire after 1 hour by default. The app creates them with a 1-year TTL at upload time, but the fallback in `receipt-detail.tsx` regenerates them with a 1-hour TTL. See Issue 5 for the fix.

### Compression Settings
| Setting | Value |
|---------|-------|
| Max width | 900px |
| JPEG quality | 65% |
| Format | JPEG |
| Web method | Canvas API |
| Native method | `expo-image-manipulator` |

---

## 9. Cleanup Tasks

The following files exist in the project root and should be removed before launch. They are development/migration artifacts and serve no runtime purpose.

| File | Reason to Remove |
|------|-----------------|
| `compare.py` | Dev script — uses hardcoded absolute paths, not needed at runtime |
| `fix_cutoff.py` | One-time migration script |
| `fix_onemodal.py` | One-time fix script |
| `fix_reminder_category.py` | One-time migration script |
| `fix_reminders_fill.py` | One-time migration script |
| `fix_space_detail_fill.py` | One-time migration script |
| `$null` | Accidental file (likely from a failed shell redirect) |
| `0` | Accidental file |
| `App.tsx` | Unused — app uses `app/_layout.tsx` via expo-router |
| `TEST_CHECKLIST.csv` | Move to a private docs folder or delete after use |

The `migrations/` folder contains SQL migration files. These should be kept but moved to a proper migration tool (e.g., Supabase CLI migrations) rather than sitting loose in the project root.

---

## 10. Implementation Priority Order

Work through these in order. Items 1–4 have the highest user-visible impact.

### Phase 1 — Critical Performance (Do First)
| # | Task | File(s) | Estimated Effort |
|---|------|---------|-----------------|
| 1 | Fix N+1 in receipts screen | `receipts.tsx` | 1–2 hours |
| 2 | Fix N+1 in bill split screen | `bill-split.tsx` | 2–3 hours |
| 3 | Fix all-time recordings full scan in spaces | `spaces.tsx` | 2–3 hours |
| 4 | Wrap `useUser` settings fetch in React Query | `useUser.ts` | 1 hour |

### Phase 2 — Medium Impact
| # | Task | File(s) | Estimated Effort |
|---|------|---------|-----------------|
| 5 | Remove signed URL regeneration | `receipt-detail.tsx` | 1 hour |
| 6 | Parallelize recording-detail DB calls | `recording-detail.tsx` | 1 hour |
| 7 | Remove `rateMap` from dashboard/spaces query keys | `dashboard.tsx`, `spaces.tsx` | 30 min |
| 8 | Parallelize multi-photo uploads | `receipts.tsx`, `receipt-detail.tsx` | 1 hour |

### Phase 3 — Database & Infrastructure
| # | Task | Where | Estimated Effort |
|---|------|-------|-----------------|
| 9 | Add Supabase indexes | Supabase SQL editor | 30 min |
| 10 | Create `get_split_bill_summaries` RPC | Supabase SQL editor | 1 hour |
| 11 | Create `get_space_all_time_totals` RPC | Supabase SQL editor | 1 hour |

### Phase 4 — Polish & Correctness
| # | Task | File(s) | Estimated Effort |
|---|------|---------|-----------------|
| 12 | Add `parseLocalDate` utility + audit all date parsing | `dateUtils.ts` + all screens | 2–3 hours |
| 13 | Update Supabase client config | `supabase.ts` | 15 min |
| 14 | Clean up dev files from root | Project root | 15 min |

---

## Appendix — Key File Map

| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Supabase client singleton |
| `src/lib/useExchangeRates.ts` | Exchange rate fetching + `convert()` helper |
| `src/hooks/useUser.ts` | Auth user + user settings hook |
| `src/lib/dateUtils.ts` | Date range calculation + label formatting |
| `src/lib/reminderUtils.ts` | Reminder due-date logic + notification scheduling |
| `src/lib/receiptUpload.ts` | Image compression + upload to R2/Supabase |
| `src/lib/receiptParser.ts` | Tesseract.js OCR + receipt line item parsing |
| `src/lib/writeOff.ts` | Write-off recording logic |
| `src/types/index.ts` | All TypeScript interfaces |
| `app/_layout.tsx` | Root layout, auth state, React Query provider |
| `app/(app)/(tabs)/dashboard.tsx` | Main activity feed + quick-add |
| `app/(app)/(tabs)/spaces.tsx` | Budget/savings spaces |
| `app/(app)/(tabs)/receipts.tsx` | Receipt folder list |
| `app/(app)/(tabs)/bill-split.tsx` | Split bill list |
| `app/(app)/(tabs)/reminders.tsx` | Recurring reminders |
| `app/(app)/(tabs)/accounts.tsx` | Bank/e-wallet accounts |
| `app/(app)/(tabs)/categories.tsx` | Transaction categories |
| `app/(app)/recording-detail.tsx` | Full recording detail + pay/collect/split |
| `app/(app)/receipt-detail.tsx` | Receipt photo viewer + OCR |
| `migrations/` | SQL migration files |

---

*Document generated by Amazon Q — Technical Review*  
*Last updated: based on current codebase state*
