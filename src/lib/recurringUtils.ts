/**
 * recurringUtils.ts
 * Helpers for computing ghost cycles from recurring_records.
 */

export interface RecurringRecord {
  id: string;
  name: string;
  type: string;
  total_amount: number;
  installment_amount: number;
  months: number;
  start_date: string;
  end_date?: string | null;
  day_of_month: number;
  status: string;
  total_paid: number;
  space_id?: string | null;
  category_id?: string | null;
}

/**
 * Returns a cycle key string for a given year+month: "YYYY-MM"
 */
export function cycleKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/**
 * Returns the due date for a given cycle key and day_of_month.
 */
export function getDueDateForCycle(rec: RecurringRecord, key: string): Date {
  const [y, m] = key.split('-').map(Number);
  const day = Math.min(rec.day_of_month, new Date(y, m, 0).getDate()); // clamp to month end
  return new Date(y, m - 1, day);
}

/**
 * Returns all cycle keys from start_date up to today (or end_date if earlier).
 */
export function getActiveCycles(rec: RecurringRecord, today: Date): string[] {
  const start = new Date(rec.start_date + 'T00:00:00');
  const end = rec.end_date ? new Date(rec.end_date + 'T00:00:00') : null;
  const ceiling = end && end < today ? end : today;

  const cycles: string[] = [];
  let y = start.getFullYear();
  let m = start.getMonth(); // 0-indexed

  while (true) {
    const key = cycleKey(y, m);
    const dueDate = getDueDateForCycle(rec, key);
    if (dueDate > ceiling) break;
    if (dueDate >= start) cycles.push(key);
    m++;
    if (m > 11) { m = 0; y++; }
    if (cycles.length > rec.months + 2) break; // safety cap
  }

  return cycles;
}

/**
 * Returns true if the loan is fully paid based on total_paid vs total_amount.
 */
export function isLoanComplete(rec: RecurringRecord): boolean {
  return rec.total_paid >= rec.total_amount - 0.01;
}

export interface GhostRow {
  rec: RecurringRecord;
  cycleKey: string;
  dueDate: Date;
  isOverdue: boolean;
}

/**
 * Computes ghost rows: cycles that are due but have no real recording yet.
 */
export function computeGhosts(
  recurringRecords: RecurringRecord[],
  existingRecordings: { recurring_record_id?: string | null; cycle_key?: string | null }[],
  today: Date = new Date(),
): GhostRow[] {
  const ghosts: GhostRow[] = [];

  for (const rec of recurringRecords) {
    if (rec.status !== 'active') continue;
    if (isLoanComplete(rec)) continue;

    const cycles = getActiveCycles(rec, today);
    for (const key of cycles) {
      const dueDate = getDueDateForCycle(rec, key);
      if (dueDate > today) continue; // not due yet

      const covered = existingRecordings.some(
        r => r.recurring_record_id === rec.id && r.cycle_key === key
      );
      if (!covered) {
        const daysDiff = Math.floor((today.getTime() - dueDate.getTime()) / 86400000);
        ghosts.push({ rec, cycleKey: key, dueDate, isOverdue: daysDiff > 1 });
      }
    }
  }

  // Sort: overdue first, then by due date desc
  ghosts.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return b.dueDate.getTime() - a.dueDate.getTime();
  });

  return ghosts;
}
