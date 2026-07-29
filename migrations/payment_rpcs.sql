-- Migration: Payment RPCs — returns + borrower tracking expense
-- Creates/updates tracking expense under the borrower for each settlement.

-- Update tag_friend_auto to create the initial tracking expense under the borrower
CREATE OR REPLACE FUNCTION tag_friend_auto(
  p_recording_id uuid,
  p_owner_id uuid,
  p_owner_name text,
  p_friend_user_id uuid,
  p_recording_name text,
  p_amount numeric,
  p_currency text DEFAULT 'PHP',
  p_transaction_date text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_type text DEFAULT 'expense'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  shared jsonb;
  v_label text;
  v_currency_display text;
BEGIN
  v_label := CASE p_type
    WHEN 'due' THEN 'dues'
    ELSE 'expense'
  END;
  v_currency_display := COALESCE(NULLIF(p_currency, ''), 'PHP');

  -- 1. Add friend to shared_with so they can see the recording
  SELECT shared_with INTO shared FROM recordings WHERE id = p_recording_id;
  IF NOT shared @> to_jsonb(ARRAY[p_friend_user_id]) THEN
    UPDATE recordings SET shared_with = shared || to_jsonb(p_friend_user_id) WHERE id = p_recording_id;
  END IF;

  -- 2. Clean up any old mirror debt recordings for this source (backward compat)
  DELETE FROM recordings
  WHERE source_recording_id = p_recording_id
    AND user_id = p_friend_user_id
    AND is_tagged = true;

  -- 3. Create/update tracking expense under the borrower
  -- Identified by: user = borrower, type = expense, linked_recording_id = original
  DELETE FROM recordings
  WHERE user_id = p_friend_user_id
    AND linked_recording_id = p_recording_id
    AND type = 'expense'
    AND is_system_generated = true;
  INSERT INTO recordings (user_id, name, type, amount, status, transaction_date, linked_recording_id, is_system_generated, payment_to, person_name)
  VALUES (p_friend_user_id, p_recording_name, 'expense', 0, 'unpaid', COALESCE(p_transaction_date::date, CURRENT_DATE), p_recording_id, true, p_recording_id, p_owner_name);

  -- 4. Send notification
  INSERT INTO notifications (user_id, type, title, body, message, data, is_read, status)
  VALUES (
    p_friend_user_id,
    'expense_tag',
    p_owner_name || ' tagged you in an ' || v_label,
    p_recording_name || ' — ' || v_currency_display || ' ' || p_amount::text,
    p_recording_name || ' — ' || v_currency_display || ' ' || p_amount::text,
    jsonb_build_object(
      'recordingId', p_recording_id,
      'sourceRecordingId', p_recording_id,
      'recordingName', p_recording_name,
      'amount', p_amount,
      'taggerName', p_owner_name,
      'taggerUserId', p_owner_id
    ),
    false,
    'new'
  );
END;
$$;

-- Record a settlement payment: create return, update paid_amount, update borrower tracking expense
CREATE OR REPLACE FUNCTION record_payment(
  p_recording_id uuid,
  p_lender_id uuid,
  p_borrower_id uuid,
  p_amount numeric,
  p_person_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec_name text;
  v_new_paid numeric;
  v_status text;
BEGIN
  -- Get recording name
  SELECT name INTO v_rec_name FROM recordings WHERE id = p_recording_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- 1. Insert return under lender
  INSERT INTO recordings (user_id, name, type, amount, status, transaction_date, linked_recording_id, person_name, payment_to)
  VALUES (p_lender_id, v_rec_name, 'return', p_amount, 'received', CURRENT_DATE, p_recording_id, p_person_name, p_borrower_id);

  -- 2. Update paid_amount on original recording
  UPDATE recordings SET
    paid_amount = COALESCE(paid_amount, 0) + p_amount
  WHERE id = p_recording_id
  RETURNING paid_amount INTO v_new_paid;

  -- Determine new status
  v_status := CASE WHEN v_new_paid >= (SELECT amount FROM recordings WHERE id = p_recording_id) - 0.01 THEN 'paid' ELSE 'partial' END;
  UPDATE recordings SET status = v_status WHERE id = p_recording_id;

  -- 3. Update borrower tracking expense amount to reflect cumulative payments
  UPDATE recordings SET amount = v_new_paid
  WHERE user_id = p_borrower_id
    AND linked_recording_id = p_recording_id
    AND type = 'expense'
    AND is_system_generated = true;
END;
$$;

-- Delete a return and cascade: deduct paid_amount, update borrower tracking expense
CREATE OR REPLACE FUNCTION delete_return(
  p_return_id uuid,
  p_lender_id uuid,
  p_borrower_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_return_amount numeric;
  v_parent_id uuid;
  v_new_paid numeric;
  v_status text;
  v_borrower_id uuid;
BEGIN
  -- Get return details
  SELECT amount, linked_recording_id INTO v_return_amount, v_parent_id
  FROM recordings WHERE id = p_return_id AND type = 'return';
  IF NOT FOUND THEN RETURN; END IF;

  v_borrower_id := p_borrower_id;
  IF v_borrower_id IS NULL THEN
    SELECT payment_to INTO v_borrower_id FROM recordings WHERE id = p_return_id;
  END IF;

  -- 1. Deduct from parent's paid_amount
  UPDATE recordings SET
    paid_amount = GREATEST(COALESCE(paid_amount, 0) - v_return_amount, 0)
  WHERE id = v_parent_id
  RETURNING paid_amount INTO v_new_paid;

  v_status := CASE WHEN v_new_paid <= 0 THEN 'unpaid' ELSE 'partial' END;
  UPDATE recordings SET status = v_status WHERE id = v_parent_id;

  -- 2. Delete the return
  DELETE FROM recordings WHERE id = p_return_id AND user_id = p_lender_id;

  -- 3. Update borrower tracking expense
  IF v_borrower_id IS NOT NULL THEN
    UPDATE recordings SET amount = v_new_paid
    WHERE user_id = v_borrower_id
      AND linked_recording_id = v_parent_id
      AND type = 'expense'
      AND is_system_generated = true;
  END IF;
END;
$$;
