/**
 * Manages the single delayed-trigger timer for a fake call sequence.
 * All React state lives in FakeCallContext; this class handles only the timer.
 */
export class FakeCallService {
  private timerId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Schedule `onFire` to be called after `delaySeconds`.
   * Any existing pending timer is cancelled first so there is never more than one
   * timer running at a time.
   * When `delaySeconds` is 0 `onFire` is called synchronously.
   */
  schedule(delaySeconds: number, onFire: () => void): void {
    this.cancelPending();
    if (delaySeconds <= 0) {
      onFire();
      return;
    }
    this.timerId = setTimeout(() => {
      this.timerId = null;
      onFire();
    }, delaySeconds * 1_000);
  }

  cancelPending(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  isCountingDown(): boolean {
    return this.timerId !== null;
  }
}
