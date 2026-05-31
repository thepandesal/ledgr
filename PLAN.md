# 💰 Ledgr — App Plan

> A personal finance app with collaborative bill splitting, goal tracking, and receipt management.

---

## App Name: **Ledgr**

## Platforms
- Mobile-first (React Native / Expo) — iOS & Android
- Web (Expo Web, deployed on Vercel)

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | React Native (Expo) |
| Backend | Supabase (Auth, Postgres, Realtime, Storage, Push) |
| Deploy | Vercel (web), EAS (mobile builds) |
| Language | TypeScript |
| Auth | Google + Apple Sign-In (Supabase Auth) |
| Storage | Supabase Storage (receipts, QR images, payment request images) |
| Notifications | Expo Push Notifications |

---

## Core Features

### 1. Authentication
- Google Sign-In
- Apple Sign-In

### 2. Workspaces ("Folders")
- Users create workspaces to encapsulate everything (e.g. "Household", "Trip to Japan", "Business")
- Each workspace has its own recordings, splits, savings, and members
- Invite members via QR code (must sign up/login first)
- Invited members must be approved by workspace owner
- Roles: Owner, Editor, Viewer
- Each workspace has a default currency (user selects on creation)

### 3. Bank Accounts (Global to User)
- Accounts are NOT per-workspace — they belong to the user globally
- User can toggle which workspaces each account is visible in (uncheck spaces they don't want)
- Users can upload QR code images to any bank account

#### Account Types:
- **Bank Account**: Choose bank, name it, upload QR
- **Credit Card**: Choose bank, name it, set due date, set payment due amount
- **ATM**: Choose bank, name it, set balance
- **Savings**: Choose bank, name it, type (Shared/Solo), goal amount, start/end date, shareholders (if shared)

### 4. Recordings
- **Fields:**
  - Name of Recording
  - Type: Purchase, Savings, Income, Payments, or custom (user can add categories)
  - Category: Defaults + user-added custom categories
  - Amount
  - Date Added (auto today, can change)
  - Optional: linked receipt image

- **Default Categories:**
  Food, Transport, Utilities, Rent, Entertainment, Health, Shopping, Subscriptions, Fitness, Others

- **Custom Categories:**
  - User can add their own
  - Can delete from dropdown without affecting past recordings

- **Multi-currency:**
  - Workspace has a default currency
  - User can change currency per recording
  - Auto-conversion shown based on live rates

- **After adding a Purchase recording:**
  - Icon on the side to enable Bill Splitting
  - Final display: Name | Total Amount | Date | Your Amount | Other's Amount

### 5. Bill Splitting
- Can come from a recording OR be a standalone feature
- When splitting:
  - Select participants (from saved contacts list)
  - Assign amounts per person
- **Payment Request Image:**
  - User picks 1–3 of their bank accounts
  - Generates downloadable image showing: amount owed, breakdown, and selected QR codes
- **Payment Confirmation:**
  - Payer marks "paid" and uploads proof (screenshot)
  - Payee confirms payment received

### 6. Contacts / People List
- Every name a user adds (during splits, shared savings, etc.) is saved to their contacts
- Reusable across all features via dropdown

### 7. Receipt Capture
- Camera or upload photo
- Users can dump receipts to record later
- Receipts can be "pinned" as a reminder to link them
- When creating a recording, user can link an existing receipt
- Receipt stays attached to the recording

### 8. Savings Goals
- Solo or Shared
- Shared: invite people via QR (must sign up/login)
- Each shareholder sees their own contribution vs. total
- Monthly savings recommendation: (goal amount ÷ months remaining ÷ number of shareholders)
- Activity feed: "Juan added ₱500"

### 9. Credit Card Payments
- Select individual items (recordings linked to that card) or select all
- Choose source(s): can pay from multiple ATMs
- Validation: error if any ATM has insufficient balance
- Auto-deducts from ATM balance
- Auto-reduces credit card "owed" amount
- Creates a "Payment" type recording for audit trail

### 10. Dashboard (per Workspace)
- Total spent this month
- Upcoming due dates
- Savings progress
- Quick actions

### 11. Due Date Reminders
- Push notification 3 days before credit card due date

### 12. Recurring Recordings
- Mark a recording as recurring (monthly rent, subscriptions)
- Auto-reminds or auto-creates each cycle

### 13. Export to CSV
- Users can download their recordings data

### 14. Dark Mode
- Full dark mode support

### 15. Pinned Receipts
- Unlinked receipts can be pinned as a reminder to record them

---

## Data Model (High Level)

```
User (global)
├── Bank Accounts (global, toggled per workspace)
│   ├── Bank (name, bank_name, qr_images[])
│   ├── Credit Card (name, bank_name, due_date, payment_due)
│   ├── ATM (name, bank_name, balance)
│   └── Savings (name, bank_name, type, goal, start, end, shareholders[])
├── Contacts (saved names for reuse)
└── Workspaces
    ├── Members (role: owner/editor/viewer, status: pending/approved)
    ├── Recordings
    │   ├── type: Purchase | Savings | Income | Payment | Custom
    │   ├── category, amount, currency, date, receipt_id
    │   └── split_id (optional)
    ├── Splits
    │   ├── participants[], amounts[], status
    │   ├── payment_request_image
    │   └── payment_proofs[]
    ├── Receipts (image_url, linked_recording_id, pinned)
    └── Settings (default_currency)
```

---

## Pages / Screens

| Screen | Purpose |
|--------|---------|
| Login | Google / Apple sign-in |
| Home | List of workspaces |
| Workspace Dashboard | Overview, quick stats, quick actions |
| Accounts | Manage all bank accounts (global) |
| Recordings | List, add, filter by type/category |
| Recording Detail | View/edit, link receipt, start split |
| Bill Split | Standalone or from recording, assign amounts |
| Payment Request | Pick QR codes, generate image |
| Receipts | Gallery of captured receipts, pin/link |
| Savings Goal | Progress, contributions, invite shareholders |
| Credit Card Pay | Select items, pick sources, confirm |
| Settings | Profile, notifications, dark mode, export |
| Invite | QR generation, pending approvals |

---

## MVP Phases

### Phase 1 (MVP)
1. Auth (Google/Apple)
2. Workspaces (create, invite, approve, roles)
3. Bank Accounts (all types, global, toggle per workspace, QR upload)
4. Recordings (all types, categories, multi-currency)
5. Bill Splitting (from recording or standalone, payment image, mark paid + proof)
6. Receipt Capture (camera/upload, pin, link)
7. Dashboard per workspace
8. Dark mode

### Phase 2
1. Savings Goals (solo/shared, invite, contributions, recommendations)
2. Credit Card Payment flow (multi-source, validation, auto-deduct)
3. Due date reminders (push notifications)
4. Recurring recordings
5. Export to CSV
6. Contacts management screen

---

## Design
- **Logo**: Ledgr Logo.png (green #00bf63 + white)
- **Primary color**: #00bf63
- **Background**: #f5f7f1
- **Font color / UI accents**: #545454
- **Body font**: Elms Sans (Google Fonts)
- **Page headers font**: Playwrite HU (Google Fonts)
- **Dark mode**: supported

## Bottom Tab Navigation
1. Spaces (workspace list)
2. Accounts (global bank accounts)
3. Receipts (quick capture + gallery)
4. Notifications

**Top Nav**: Profile icon (user's initial/avatar) → opens Profile/Settings

## Notes
- Currency conversion: use a free API (e.g. exchangerate-api.com or open.er-api.com)
- All QR codes for bank accounts are uploaded images (not generated)
- Payment request image is generated by the app (canvas/image composition)
