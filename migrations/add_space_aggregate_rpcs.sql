-- RPC: aggregate all-time income/expense totals per space for a user
-- Used by spaces.tsx to replace the full-table allTimeRecs scan
CREATE OR REPLACE FUNCTION get_space_all_time_totals(p_user_id uuid)
RETURNS TABLE (space_id uuid, income_total numeric, expense_total numeric) AS $$
  SELECT
    space_id,
    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income_total,
    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense_total
  FROM recordings
  WHERE user_id = p_user_id
    AND type IN ('income', 'expense')
    AND status != 'voided'
  GROUP BY space_id;
$$ LANGUAGE sql STABLE;

-- RPC: same aggregate but filtered by a list of space IDs (for shared spaces)
CREATE OR REPLACE FUNCTION get_space_all_time_totals_by_ids(p_space_ids uuid[])
RETURNS TABLE (space_id uuid, income_total numeric, expense_total numeric) AS $$
  SELECT
    space_id,
    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income_total,
    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense_total
  FROM recordings
  WHERE space_id = ANY(p_space_ids)
    AND type IN ('income', 'expense')
    AND status != 'voided'
  GROUP BY space_id;
$$ LANGUAGE sql STABLE;
