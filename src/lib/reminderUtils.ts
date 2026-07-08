import type { RecordingReminder } from '../types';

/**
 * Returns true if the reminder is due on `today`.
 */
export function isReminderDueToday(reminder: RecordingReminder, today: Date = new Date()): boolean {
  if (reminder.status !== 'active') return false;

  const start = new Date(reminder.start_date + 'T00:00:00');
  if (today < start) return false;

  if (reminder.end_date) {
    const end = new Date(reminder.end_date + 'T00:00:00');
    if (today > end) return false;
  }

  switch (reminder.frequency) {
    case 'daily':
      return true;

    case 'weekly':
      return reminder.day_of_week != null && today.getDay() === reminder.day_of_week;

    case 'monthly':
      return reminder.day_of_month != null && today.getDate() === reminder.day_of_month;

    case 'interval': {
      if (!reminder.interval_days || reminder.interval_days <= 0) return false;
      const diffMs = today.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0);
      const diffDays = Math.round(diffMs / 86400000);
      return diffDays >= 0 && diffDays % reminder.interval_days === 0;
    }
  }
}

/**
 * Returns a human-readable recurrence label for a reminder.
 */
export function reminderFrequencyLabel(reminder: RecordingReminder): string {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  switch (reminder.frequency) {
    case 'daily':   return 'every day';
    case 'weekly':  return `every ${reminder.day_of_week != null ? DAYS[reminder.day_of_week] : 'week'}`;
    case 'monthly': return `every ${reminder.day_of_month != null ? `${reminder.day_of_month}th` : 'month'}`;
    default:        return reminder.frequency;
  }
}

/**
 * Returns the next due date for a reminder after `from`.
 * Returns null if the reminder has ended.
 */
export function nextDueDate(reminder: RecordingReminder, from: Date = new Date()): Date | null {
  if (reminder.status !== 'active') return null;

  const start = new Date(reminder.start_date + 'T00:00:00');
  const end   = reminder.end_date ? new Date(reminder.end_date + 'T00:00:00') : null;
  const base  = from < start ? start : from;

  let candidate: Date | null = null;

  switch (reminder.frequency) {
    case 'daily':
      candidate = new Date(base);
      break;

    case 'weekly': {
      if (reminder.day_of_week == null) return null;
      const d = new Date(base);
      const diff = (reminder.day_of_week - d.getDay() + 7) % 7;
      d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
      candidate = d;
      break;
    }

    case 'monthly': {
      if (reminder.day_of_month == null) return null;
      const d = new Date(base.getFullYear(), base.getMonth(), reminder.day_of_month);
      if (d <= base) d.setMonth(d.getMonth() + 1);
      candidate = d;
      break;
    }

    case 'interval': {
      if (!reminder.interval_days || reminder.interval_days <= 0) return null;
      const diffDays = Math.ceil((base.getTime() - start.getTime()) / 86400000);
      const rem = diffDays % reminder.interval_days;
      const daysUntil = rem === 0 ? 0 : reminder.interval_days - rem;
      const d = new Date(base);
      d.setDate(d.getDate() + daysUntil);
      candidate = d;
      break;
    }
  }

  if (!candidate) return null;
  if (end && candidate > end) return null;
  return candidate;
}

/**
 * Schedules an Expo push notification for a reminder's next due date.
 * Call this after creating/editing a reminder.
 * No-op on web.
 */
export async function scheduleReminderNotification(reminder: RecordingReminder): Promise<void> {
  if (typeof window !== 'undefined' && !('Notification' in window)) return; // web guard
  try {
    const Notifications = require('expo-notifications');
    const due = nextDueDate(reminder, new Date());
    if (!due) return;

    // Cancel any existing notification for this reminder
    await Notifications.cancelScheduledNotificationAsync(reminder.id).catch(() => {});

    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: {
        title: 'Reminder due today',
        body: `"${reminder.name}" is due today.`,
        data: { reminderId: reminder.id },
      },
      trigger: {
        date: due,
      },
    });
  } catch {
    // expo-notifications may not be installed — silently skip
  }
}
