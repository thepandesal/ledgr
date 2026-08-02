/**
 * splitBillUtils.ts
 * Shared utilities for split bill calculations.
 */

export interface SplitItem {
  id: string;
  cost: number | string;
  people: string[];
  recording_id: string | null;
  parent_item_id: string | null;
  recording_type: string | null;
}

const isDeductType = (type: string | null) => type === 'payable' || type === 'debt';

/**
 * Compute per-person totals from split items.
 * Skips parent container items (items that have children).
 */
export function computeSplitTotals(items: SplitItem[]): Record<string, number> {
  const totals: Record<string, number> = {};

  // Build set of parent item ids (items that have children via parent_item_id)
  const parentIds = new Set(
    items.filter(i => i.parent_item_id).map(i => i.parent_item_id as string)
  );

  // Count items per recording_id to detect recording group parents
  const recIdCounts: Record<string, number> = {};
  items.forEach(i => {
    if (i.recording_id) recIdCounts[i.recording_id] = (recIdCounts[i.recording_id] ?? 0) + 1;
  });

  items.forEach(item => {
    // Skip parent containers (has children via parent_item_id)
    if (parentIds.has(item.id)) return;
    // Skip recording group parents (shared recording_id, no people assigned)
    if (item.recording_id && recIdCounts[item.recording_id] > 1 && (item.people ?? []).length === 0) return;

    const deduct = isDeductType(item.recording_type);
    const pp = (item.people ?? []).length > 0 ? Number(item.cost) / item.people.length : 0;
    (item.people ?? []).forEach(p => {
      totals[p] = (totals[p] ?? 0) + (deduct ? -pp : pp);
    });
  });

  return totals;
}
