/**
 * ReminderService — schedules (and cancels) local push notifications
 * for approved swap posts.
 *
 * Scheduling strategy:
 *   • Owner reminders are scheduled on the owner's device immediately after
 *     they approve a helper (in PostDetailScreen).
 *   • Sitter reminders are scheduled on the sitter's device the first time
 *     they view the Accepted tab after being approved (in RequestsScreen).
 *
 * Each approved post gets up to 3 owner reminders + 3 sitter reminders (6 total
 * across both devices). Reminders that would fire in the past are silently skipped.
 */

import * as Notifications from 'expo-notifications';

// ─── Permissions ──────────────────────────────────────────────────────────────

export const requestNotificationPermissions = async (): Promise<boolean> => {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a Date set to `hour`:`minute` on the same calendar day as `base`.
 * Returns null if the result would already be in the past.
 */
const reminderDate = (base: Date, hour: number, minute = 0): Date | null => {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d > new Date() ? d : null;
};

/**
 * Schedule a single local notification at a future date.
 * Returns the notification ID, or null if the date is in the past / scheduling fails.
 */
const scheduleOne = async (
  title: string,
  body: string,
  date: Date | null
): Promise<string | null> => {
  if (!date) return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      },
    });
    return id;
  } catch {
    return null;
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SwapReminderParams {
  startDate: Date;
  dogName: string;
  ownerName: string;
  sitterName: string;
}

export interface ScheduledReminderIds {
  ownerIds: string[];
  sitterIds: string[];
}

/**
 * Schedule all owner-side reminders for an approved swap post.
 * Call this on the OWNER's device right after approveHelper() succeeds.
 * Returns the scheduled notification IDs (may be fewer than 3 if some are in the past).
 */
export const scheduleOwnerReminders = async (
  params: SwapReminderParams
): Promise<string[]> => {
  const { startDate, dogName, sitterName } = params;

  const twoDaysBefore = new Date(startDate);
  twoDaysBefore.setDate(twoDaysBefore.getDate() - 2);

  const oneDayBefore = new Date(startDate);
  oneDayBefore.setDate(oneDayBefore.getDate() - 1);

  const results = await Promise.all([
    scheduleOne(
      '🐾 Swap Reminder',
      `🐾 Reminder: ${dogName}'s care starts in 2 days! Make sure everything is set with ${sitterName}.`,
      reminderDate(twoDaysBefore, 9)
    ),
    scheduleOne(
      '🐾 Swap Reminder',
      `🐾 Tomorrow! ${dogName}'s care starts tomorrow. Touch base with ${sitterName} if you haven't already.`,
      reminderDate(oneDayBefore, 9)
    ),
    scheduleOne(
      '🐾 Today\'s the Day!',
      `🐾 Today's the day! ${dogName}'s care begins today. Have a great swap!`,
      reminderDate(startDate, 8)
    ),
  ]);

  return results.filter((id): id is string => id !== null);
};

/**
 * Schedule all sitter-side reminders for an approved swap post.
 * Call this on the SITTER's device when they first see the post in the Accepted tab.
 * Returns the scheduled notification IDs.
 */
export const scheduleSitterReminders = async (
  params: SwapReminderParams
): Promise<string[]> => {
  const { startDate, dogName, ownerName } = params;

  const twoDaysBefore = new Date(startDate);
  twoDaysBefore.setDate(twoDaysBefore.getDate() - 2);

  const oneDayBefore = new Date(startDate);
  oneDayBefore.setDate(oneDayBefore.getDate() - 1);

  const results = await Promise.all([
    scheduleOne(
      '🐾 Swap Reminder',
      `🐾 Reminder: You're watching ${dogName} in 2 days! Touch base with ${ownerName} if needed.`,
      reminderDate(twoDaysBefore, 9)
    ),
    scheduleOne(
      '🐾 Swap Reminder',
      `🐾 Tomorrow! You're watching ${dogName} starting tomorrow. Get ready! 🐕`,
      reminderDate(oneDayBefore, 9)
    ),
    scheduleOne(
      '🐾 Today\'s the Day!',
      `🐾 Today's the day! Time to take care of ${dogName}. Have fun! 🐕`,
      reminderDate(startDate, 8)
    ),
  ]);

  return results.filter((id): id is string => id !== null);
};

/**
 * Cancel a list of scheduled notifications by ID.
 * Safe to call with an empty array or undefined IDs.
 */
export const cancelSwapReminders = async (ids: string[]): Promise<void> => {
  if (!ids || ids.length === 0) return;
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
};
