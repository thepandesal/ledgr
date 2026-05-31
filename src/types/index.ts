export type AccountType = 'bank' | 'credit_card' | 'atm' | 'savings';
export type SavingsType = 'solo' | 'shared';
export type RecordingType = 'purchase' | 'savings' | 'income' | 'payment' | 'custom';
export type SplitStatus = 'pending' | 'paid' | 'confirmed';
export type MemberRole = 'owner' | 'editor' | 'viewer';
export type MemberStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  default_currency: string;
  owner_id: string;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  invited_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  type: AccountType;
  name: string;
  bank_name: string;
  qr_images: string[];
  due_date?: number; // day of month (credit card)
  payment_due?: number; // amount (credit card)
  balance?: number; // ATM
  savings_type?: SavingsType;
  goal_amount?: number;
  goal_start?: string;
  goal_end?: string;
  created_at: string;
}

export interface AccountWorkspace {
  id: string;
  account_id: string;
  workspace_id: string;
}

export interface Shareholder {
  id: string;
  account_id: string;
  contact_id: string;
  user_id?: string;
  contribution: number;
}

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  workspace_id: string;
  name: string;
  is_default: boolean;
}

export interface Recording {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  type: RecordingType;
  category: string;
  amount: number;
  currency: string;
  date: string;
  account_id?: string;
  receipt_id?: string;
  split_id?: string;
  is_recurring: boolean;
  recurring_frequency?: 'weekly' | 'monthly' | 'yearly';
  created_at: string;
}

export interface Split {
  id: string;
  workspace_id: string;
  recording_id?: string;
  name: string;
  total_amount: number;
  currency: string;
  created_by: string;
  created_at: string;
}

export interface SplitParticipant {
  id: string;
  split_id: string;
  contact_id: string;
  user_id?: string;
  amount: number;
  status: SplitStatus;
  proof_image?: string;
  confirmed_at?: string;
}

export interface Receipt {
  id: string;
  workspace_id: string;
  user_id: string;
  image_url: string;
  pinned: boolean;
  recording_id?: string;
  uploaded_at: string;
}

export interface PaymentRequest {
  id: string;
  split_id: string;
  account_ids: string[]; // 1-3 bank accounts with QR
  image_url: string;
  created_at: string;
}
