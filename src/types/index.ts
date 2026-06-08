// ─── Database entities ────────────────────────────────────────────────────────

export interface Space {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  budget?: number | null;
  default_category_id?: string | null;
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

export type RecordingType = 'expense' | 'income' | 'savings' | 'payable' | 'receivable' | 'expense' | 'return';
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
  created_at: string;
}

export interface ReceiptPhoto {
  id: string;
  entry_id: string;
  storage_path: string;
  url: string;
  created_at: string;
}

export interface BillSplit {
  id: string;
  recording_id: string;
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
  recording_id: string;
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
  recording_id: string;
  data: { account_ids?: string[] };
}

export interface RecordingBreakdown {
  id: string;
  recording_id: string;
  person: string;
  amount: number;
  account_id: string | null;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export interface PersonPayStatus {
  person: string;
  paid: number;
  total: number;
}
