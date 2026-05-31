# 📱 Ledgr — Pages & Functions

---

## 1. Login / Sign Up
- Google Sign-In button
- Apple Sign-In button
- Auto-redirect to Home if already authenticated

---

## 2. Home (Workspace List)
- List all workspaces the user belongs to (owned + joined)
- Create new workspace button
- Show workspace name, member count, default currency
- Tap workspace → go to Workspace Dashboard
- Show pending invites badge/notification
- Quick access to global Bank Accounts

---

## 3. Create Workspace
- Name the workspace
- Select default currency
- Create button → redirects to Workspace Dashboard

---

## 4. Workspace Dashboard
- **Stats:**
  - Total spent this month
  - Upcoming credit card due dates
  - Savings goal progress bars
  - Recent activity feed
- **Quick Actions:**
  - Add Recording
  - Split a Bill
  - Capture Receipt
- **Navigation to:**
  - Recordings
  - Bill Splits
  - Receipts
  - Savings Goals
  - Members
  - Workspace Settings

---

## 5. Workspace Members
- List all members (name, role, status)
- Show pending invites (awaiting approval)
- Approve / Reject pending members
- Generate QR invite (select role: Editor or Viewer)
- Share QR invite link
- Remove member (owner only)
- Change member role (owner only)

---

## 6. Workspace Settings
- Edit workspace name
- Change default currency
- Delete workspace (owner only)
- Leave workspace (non-owners)

---

## 7. Bank Accounts (Global)
- List all user's accounts grouped by type (Bank, Credit Card, ATM, Savings)
- Add new account button
- Tap account → Account Detail
- Toggle: show which workspaces each account is visible in

---

## 8. Add / Edit Bank Account
- Select type: Bank | Credit Card | ATM | Savings
- **All types:**
  - Choose bank (from list or type custom)
  - Name the account
  - Upload QR image(s)
  - Select which workspaces it's visible in
- **Credit Card additional:**
  - Due date (day of month)
  - Payment due amount
- **ATM additional:**
  - Current balance
- **Savings additional:**
  - Type: Solo or Shared
  - Goal amount
  - Goal start date
  - Goal end date
  - If Shared: add shareholder names (from contacts)
  - Shows monthly savings recommendation

---

## 9. Account Detail
- View all account info
- Edit button → Edit Account
- **Credit Card:** show linked recordings (purchases on this card), total owed
- **ATM:** show balance, recent deductions
- **Savings:** show progress bar, contributions list, monthly recommendation
- **Bank:** show QR image(s)
- Delete account

---

## 10. Recordings (List)
- List all recordings in the workspace
- Filter by: type, category, date range
- Sort by: date, amount
- Search by name
- Each row shows: name, type icon, category, amount, date
- Purchase recordings show split icon if split exists
- Tap recording → Recording Detail
- Floating "+" button → Add Recording

---

## 11. Add Recording
- Name of recording
- Type: Purchase, Savings, Income, Payment, or custom
- Category dropdown:
  - Defaults: Food, Transport, Utilities, Rent, Entertainment, Health, Shopping, Subscriptions, Fitness, Others
  - "Add Category" option at bottom
  - "Delete Category" option per custom category (doesn't affect past recordings)
- Amount
- Currency (defaults to workspace currency, can change — shows conversion)
- Date (auto today, can change via date picker)
- Link receipt (optional — pick from existing receipts or capture new)
- Link to account (optional — which card/ATM was used)
- Mark as recurring (toggle — if yes, select frequency: weekly/monthly/yearly)
- Save button

---

## 12. Recording Detail
- View all recording info
- Edit button
- Delete button
- If Purchase: "Split this bill" button/icon
- If linked to receipt: show receipt thumbnail (tap to view full)
- If split exists: show split summary (your amount, others' amounts)
- If Payment type: show source account and what was paid

---

## 13. Bill Splits (List)
- List all splits in the workspace
- Filter by: status (pending, completed), date
- Each row: name/description, total, your share, status
- Tap → Split Detail
- Floating "+" button → Create Split (standalone)

---

## 14. Create / Edit Split
- **If from recording:** auto-fills name and total amount
- **If standalone:** enter name and total amount
- Add participants (from contacts dropdown + "add new" option)
- Assign amounts per person (manual or split equally button)
- Your amount (auto-calculated as remainder)
- Save → goes to Split Detail

---

## 15. Split Detail
- Name, total amount, date
- List of participants with their amounts and status (paid/unpaid)
- **For payee (you are owed):**
  - "Generate Payment Request" button
  - View payment proofs uploaded by payers
  - Confirm/reject each payment
- **For payer (you owe):**
  - "Mark as Paid" button → upload proof (photo/screenshot)
  - Status: pending confirmation / confirmed

---

## 16. Generate Payment Request
- Select 1–3 bank accounts (shows their QR images)
- Preview generated image:
  - Amount owed
  - Breakdown per person
  - Selected QR code(s)
  - Your name / account details
- Download image button
- Share image button

---

## 17. Receipts (Gallery)
- Grid/list of all receipts in workspace
- Filter: pinned, linked, unlinked
- Each shows: thumbnail, date uploaded, linked recording name (or "Unlinked")
- Pin/unpin toggle
- Tap → Receipt Detail
- Floating "+" button → Capture Receipt

---

## 18. Capture Receipt
- Camera capture button
- Upload from gallery button
- After capture/upload: preview image
- Option to pin it
- Option to link to existing recording or create new recording now
- Save

---

## 19. Receipt Detail
- Full image view (zoomable)
- Date uploaded
- Linked recording (tap to go to it) or "Link to recording" button
- Pin/unpin
- Delete

---

## 20. Savings Goals (List)
- List all savings accounts with goals
- Each shows: name, progress bar, amount saved / goal, type (solo/shared)
- Tap → Savings Goal Detail

---

## 21. Savings Goal Detail
- Progress bar (amount saved / goal amount)
- Monthly recommendation (total remaining ÷ months left ÷ shareholders)
- Start date, end date, days remaining
- **If Shared:**
  - List of shareholders with individual contributions
  - Activity feed ("Juan added ₱500 on Jan 15")
  - Invite shareholder button (QR)
- **If Solo:**
  - Contribution history
- "Add Contribution" button → creates a Savings recording
- Edit goal button

---

## 22. Credit Card Payment
- Select credit card account
- List of unpaid recordings linked to this card (checkboxes)
- "Select All" toggle
- Total to pay (sum of selected)
- Select source(s):
  - Pick ATM account(s)
  - Enter amount per source
  - Shows available balance per ATM
  - Error if any source has insufficient funds
- Confirm payment button:
  - Deducts from ATM balance(s)
  - Reduces credit card owed amount
  - Creates a "Payment" recording automatically
  - Marks selected recordings as paid

---

## 23. Contacts
- List all saved contacts (names added during splits, savings, etc.)
- Add new contact manually
- Edit contact name
- Delete contact
- Search contacts

---

## 24. Notifications
- List of push notifications received
- Types:
  - Workspace invite received
  - Invite approved/rejected
  - Bill split assigned to you
  - Payment proof uploaded (for payee to confirm)
  - Payment confirmed
  - Credit card due in 3 days
  - Savings goal milestone reached
  - Recurring recording reminder
- Tap notification → navigates to relevant screen

---

## 25. Profile / Settings
- Profile photo (from Google/Apple)
- Display name
- Email (read-only, from auth)
- Dark mode toggle
- Export data to CSV (select workspace, date range)
- Notification preferences (toggle per type)
- Log out

---

## 26. Invite Scanner
- QR code scanner (camera)
- After scanning: shows workspace name, role offered
- "Request to Join" button
- Confirmation: "Request sent, awaiting approval"

---

## Navigation Structure

```
Bottom Tab Bar:
├── Home (Workspace List)
├── Accounts (Global Bank Accounts)
├── Receipts (Quick capture + gallery)
├── Notifications
└── Profile / Settings

Inside a Workspace (top tabs or section nav):
├── Dashboard
├── Recordings
├── Splits
├── Savings
├── Members
└── Settings
```

---

## Total Pages: 26
