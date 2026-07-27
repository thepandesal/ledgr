-- Migration: add default_currency to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS default_currency text NOT NULL DEFAULT 'PHP';

-- Migration: add require_tag_approval to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS require_tag_approval boolean NOT NULL DEFAULT false;

-- Function: delete_user_data
-- Deletes ALL data for a given user_id, then deletes the auth user.
-- Must be called with service role (from an Edge Function or trusted server).
CREATE OR REPLACE FUNCTION delete_user_data(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- receipt photos (storage paths — app must delete from R2/Supabase Storage separately)
  DELETE FROM receipt_photos
    WHERE entry_id IN (SELECT id FROM receipt_entries WHERE user_id = target_user_id);

  DELETE FROM receipt_entries       WHERE user_id = target_user_id;

  -- split bill data
  DELETE FROM split_items           WHERE split_bill_id IN (SELECT id FROM split_bills WHERE user_id = target_user_id);
  DELETE FROM bill_splits           WHERE split_bill_id IN (SELECT id FROM split_bills WHERE user_id = target_user_id);
  DELETE FROM split_bill_payments   WHERE split_bill_id IN (SELECT id FROM split_bills WHERE user_id = target_user_id);
  DELETE FROM split_bill_recordings WHERE split_bill_id IN (SELECT id FROM split_bills WHERE user_id = target_user_id);
  DELETE FROM split_shares          WHERE split_bill_id IN (SELECT id FROM split_bills WHERE user_id = target_user_id);
  DELETE FROM split_bills           WHERE user_id = target_user_id;

  -- recordings & related
  DELETE FROM recording_breakdowns  WHERE recording_id IN (SELECT id FROM recordings WHERE user_id = target_user_id);
  DELETE FROM recordings            WHERE user_id = target_user_id;

  -- reminders
  DELETE FROM recording_reminders   WHERE user_id = target_user_id;

  -- spaces & members
  DELETE FROM space_members         WHERE user_id = target_user_id;
  DELETE FROM spaces                WHERE user_id = target_user_id;

  -- other user tables
  DELETE FROM accounts              WHERE user_id = target_user_id;
  DELETE FROM categories            WHERE user_id = target_user_id;
  DELETE FROM contacts              WHERE user_id = target_user_id;
  DELETE FROM notifications         WHERE user_id = target_user_id;
  DELETE FROM push_tokens           WHERE user_id = target_user_id;
  DELETE FROM user_settings         WHERE user_id = target_user_id;

  -- finally delete the auth user (requires service role)
  DELETE FROM auth.users            WHERE id = target_user_id;
END;
$$;
