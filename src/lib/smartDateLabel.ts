/**
 * smartDateLabel
 * Returns a human-friendly label for a YYYY-MM-DD date string:
 *   - Today
 *   - Yesterday
 *   - Within this week (Sun–Sat): "Wednesday, Jan 15"
 *   - Otherwise: "Jan 15, 2025"
 */
export function smartDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date       = new Date(y, m - 1, d);
  const today      = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays   = Math.floor((todayStart.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  // Same Sun–Sat week as today
  const todayDay  = todayStart.getDay(); // 0 = Sun
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - todayDay);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  if (date >= weekStart && date <= weekEnd) {
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    const short   = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${weekday}, ${short}`;
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
