export type DateMode = 'monthly' | 'weekly' | 'daily' | 'yearly' | 'custom';
export type WeekStart = 'monday' | 'sunday' | 'saturday';

export function getDateRange(
  mode: DateMode,
  offset: number,
  weekStart: WeekStart,
  useCutoff: boolean,
  cutoffDay: number,
  customFrom?: Date,
  customTo?: Date,
): { from: Date; to: Date } {
  if (mode === 'custom' && customFrom && customTo) return { from: customFrom, to: customTo };

  const now = new Date();

  if (mode === 'monthly') {
    if (useCutoff && cutoffDay >= 1 && cutoffDay <= 31) {
      let cycleStartMonth = now.getMonth();
      let cycleStartYear  = now.getFullYear();
      if (now.getDate() < cutoffDay) {
        cycleStartMonth -= 1;
        if (cycleStartMonth < 0) { cycleStartMonth = 11; cycleStartYear -= 1; }
      }
      const baseDate = new Date(cycleStartYear, cycleStartMonth + offset, 1);
      const y = baseDate.getFullYear();
      const m = baseDate.getMonth();
      return { from: new Date(y, m, cutoffDay), to: new Date(y, m + 1, cutoffDay - 1) };
    }
    const y = now.getFullYear();
    const m = now.getMonth() + offset;
    return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0) };
  }

  if (mode === 'yearly') {
    const y = now.getFullYear() + offset;
    return { from: new Date(y, 0, 1), to: new Date(y, 11, 31) };
  }

  if (mode === 'daily') {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return { from: d, to: d };
  }

  // weekly
  const startDay = weekStart === 'monday' ? 1 : weekStart === 'sunday' ? 0 : 6;
  const day = now.getDay();
  const diff = (day - startDay + 7) % 7;
  const weekFrom = new Date(now);
  weekFrom.setDate(now.getDate() - diff + offset * 7);
  const weekTo = new Date(weekFrom);
  weekTo.setDate(weekFrom.getDate() + 6);
  return { from: weekFrom, to: weekTo };
}

export function getDateLabel(
  mode: DateMode,
  offset: number,
  weekStart: WeekStart,
  useCutoff: boolean,
  cutoffDay: number,
  customFrom?: Date,
  customTo?: Date,
): string {
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  if (mode === 'custom' && customFrom && customTo) {
    return `${M[customFrom.getMonth()]} ${customFrom.getDate()} – ${M[customTo.getMonth()]} ${customTo.getDate()}, ${customTo.getFullYear()}`;
  }

  const { from, to } = getDateRange(mode, offset, weekStart, useCutoff, cutoffDay);

  if (mode === 'monthly') {
    if (useCutoff && cutoffDay >= 1 && cutoffDay <= 31) {
      return `${M[from.getMonth()]} ${from.getDate()} – ${M[to.getMonth()]} ${to.getDate()}`;
    }
    return `${M[from.getMonth()]} ${from.getFullYear()}`;
  }
  if (mode === 'yearly') return `${from.getFullYear()}`;
  if (mode === 'daily') {
    const isToday = from.toDateString() === new Date().toDateString();
    return isToday ? 'Today' : `${M[from.getMonth()]} ${from.getDate()}, ${from.getFullYear()}`;
  }
  return `${M[from.getMonth()]} ${from.getDate()} – ${M[to.getMonth()]} ${to.getDate()}`;
}
