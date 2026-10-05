import * as Notifications from 'expo-notifications';

/** Identifies the fake-call backstop notification so at most one is ever pending. */
export const FAKE_CALL_NOTIFICATION_ID = 'wayloc.fake-call';

/**
 * Manages the delayed-trigger timer for a fake call sequence, plus a scheduled
 * local-notification backstop. All React state lives in FakeCallContext; this
 * class handles only the trigger mechanics.
 *
 * Why both a timer and a notification: the countdown screen is shown
 * immediately on tap, and for the common case (screen stays on, app stays
 * foregrounded for up to 60s) the JS timer alone is fine. But nothing keeps
 * the screen from locking or the app from being backgrounded during that
 * wait — exactly the moment this feature exists for, someone glancing away
 * or the phone auto-locking is realistic, not an edge case. A locally
 * scheduled notification is OS-scheduled and fires regardless of whether the
 * JS timer got to run, and shows on the lock screen even if the app never
 * gets to update its own UI in time.
 */
export class FakeCallService {
  private timerId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Schedule `onFire` to be called after `delaySeconds`, and schedule a
   * matching backstop notification for the same delay.
   * Any existing pending timer/notification is cancelled first so there is
   * never more than one pending at a time.
   * When `delaySeconds` is 0 `onFire` is called synchronously (no
   * notification needed — there's nothing for it to protect against).
   */
  schedule(delaySeconds: number, onFire: () => void, callerLabel?: string): void {
    this.cancelPending();
    if (delaySeconds <= 0) {
      onFire();
      return;
    }
    this.timerId = setTimeout(() => {
      this.timerId = null;
      // The JS path fired successfully — the notification backstop is no
      // longer needed and would otherwise show a redundant duplicate alert
      // moments after the in-app ringing UI already appeared.
      void this.cancelBackstopNotification();
      onFire();
    }, delaySeconds * 1_000);

    void this.scheduleBackstopNotification(delaySeconds, callerLabel);
  }

  cancelPending(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    void this.cancelBackstopNotification();
  }

  isCountingDown(): boolean {
    return this.timerId !== null;
  }

  private async scheduleBackstopNotification(
    delaySeconds: number,
    callerLabel?: string,
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: FAKE_CALL_NOTIFICATION_ID,
        content: {
          title: `Incoming call${callerLabel ? ` — ${callerLabel}` : ''}`,
          body: 'Tap to answer',
          sound: true,
          data: { type: 'FAKE_CALL' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: delaySeconds,
        },
      });
    } catch {
      // Best-effort backstop — if scheduling fails (e.g. permission not
      // granted), the JS timer above is still the primary path.
    }
  }

  private async cancelBackstopNotification(): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(FAKE_CALL_NOTIFICATION_ID).catch(() => {});
    await Notifications.dismissNotificationAsync(FAKE_CALL_NOTIFICATION_ID).catch(() => {});
  }
}
