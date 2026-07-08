// ─── Database entities ────────────────────────────────────────────────────────

export interface Space {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  budget?: number | null;
  default_category_id?: string | null;
  is_active: boolean;
  created_at: string;
  // computed client-side
  spent?: number;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  is_default: boolean;
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  account_name: string;
  holder_name: string;
  bank: string;
  account_number: string;
  account_type: string;
  qr_code: string | null;
  color: string;
  created_at: string;
}

export type RecordingType = 'expense' | 'income' | 'return' | 'debt' | 'due';
export type RecordingStatus = 'paid' | 'unpaid' | 'partial' | 'pending' | 'received' | 'saved';

export interface Recording {
  id: string;
  user_id: string;
  space_id: string;
  name: string;
  type: RecordingType;
  status: RecordingStatus;
  amount: number;
  transaction_date: string;
  notes?: string | null;
  category_id?: string | null;
  account_id?: string | null;
  linked_recording_id?: string | null;
  paid_amount?: number | null;
  split_bill_id?: string | null;
  split_bill_payment_id?: string | null;
  payment_to?: string | null;
  payment_from_account_id?: string | null;
  receive_to_account_id?: string | null;
  decreased_from_account_id?: string | null;
  created_at: string;
  // joined
  categories?: Pick<Category, 'name' | 'color' | 'icon'> | null;
  account?: Pick<Account, 'account_name' | 'bank'> | null;
}

export interface ReceiptEntry {
  id: string;
  user_id: string;
  note: string | null;
  recording_id: string | null;
  split_bill_id: string | null;
  created_at: string;
}

export interface ReceiptPhoto {
  id: string;
  entry_id: string;
  storage_path: string;
  url: string;
  created_at: string;
}

export interface SplitBill {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  // computed client-side
  recording_count?: number;
  people_count?: number;
  total_amount?: number;
}

export interface SplitBillRecording {
  id: string;
  split_bill_id: string;
  recording_id: string;
  amount_contributed: number;
  created_at: string;
  // joined
  recording?: Pick<Recording, 'id' | 'name' | 'amount' | 'type' | 'transaction_date'>;
}

export interface SplitAdjustment {
  id: string;
  split_bill_id: string;
  type: 'expense' | 'receivable';
  name: string;
  amount: number;
  people: string[];
  mode: 'equal' | 'manual';
  manual_amounts: Record<string, number>;
  source_recording_id: string | null;
  created_at: string;
}

export interface BillSplit {
  id: string;
  recording_id: string | null;
  split_bill_id: string | null;
  user_id: string;
  person_name: string;
  created_at: string;
}

export interface SplitSubitem {
  id: string;
  item_id: string;
  name: string;
  cost: number;
  people: string[];
}

export interface SplitItem {
  id: string;
  recording_id: string | null;
  split_bill_id: string | null;
  user_id: string;
  name: string;
  cost: number;
  people: string[];
  subitems: SplitSubitem[];
}

export interface Contact {
  id: string;
  user_id: string;
  name: string;
}

export interface SplitShare {
  id: string;
  recording_id: string | null;
  split_bill_id: string | null;
  data: { account_ids?: string[] };
}

export interface RecordingBreakdown {
  id: string;
  recording_id: string;
  person: string;
  amount: number;
  account_id: string | null;
}

export type ReminderFrequency = 'daily' | 'weekly' | 'monthly';
export type ReminderStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface RecordingReminder {
  id: string;
  user_id: string;
  workspace_id?: string | null;
  name: string;
  category_id?: string | null;
  account_id?: string | null;
  frequency: ReminderFrequency;
  day_of_week?: number | null;   // 0=Sun…6=Sat
  day_of_month?: number | null;  // 1–31
  interval_days?: number | null;
  start_date: string;            // YYYY-MM-DD
  end_date?: string | null;
  recording_type: 'expense' | 'income' | 'debt' | 'due';
  status: ReminderStatus;
  created_at: string;
  // joined
  categories?: Pick<Category, 'name' | 'color' | 'icon'> | null;
  account?: Pick<Account, 'account_name' | 'bank'> | null;
  space?: Pick<Space, 'name' | 'color'> | null;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export interface PersonPayStatus {
  person: string;
  paid: number;
  total: number;
}
