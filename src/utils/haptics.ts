import * as Haptics from 'expo-haptics';

/**
 * Haptic feedback, named by what it means rather than by how it feels.
 *
 * Call sites say `haptics.guardiansAlerted()`, not
 * `notificationAsync(Success)` — so the mapping from meaning to impact style
 * lives here, and changing how something feels is one edit rather than a search
 * through screens.
 *
 * **Every call is fire-and-forget and swallows errors.** Haptics are absent on
 * the simulator, on many Android devices, and whenever the user has turned
 * system haptics off. None of that is a failure worth surfacing — an SOS that
 * threw because the phone could not buzz would be an absurd way to fail.
 */
function fire(run: () => Promise<void>): void {
  void run().catch(() => {});
}

export const haptics = {
  /** A check-in was sent. Light: an acknowledgement, not an event. */
  checkIn(): void {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },

  /**
   * The SOS hold crossed into a new tier.
   *
   * The most important haptic in the app. The hold has two thresholds and the
   * user's eyes may be anywhere — on the street, on whoever is worrying them —
   * so the step at 3 s is how they learn their guardians have been told without
   * looking. Medium at tier 1, Heavy at tier 2, so the two are distinguishable
   * through a pocket.
   */
  sosTierReached(tier: 1 | 2): void {
    fire(() =>
      Haptics.impactAsync(
        tier >= 2 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium,
      ),
    );
  },

  /** Arrived safely. The one unambiguously good outcome in the app. */
  arrived(): void {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },

  /**
   * Something was sent that the user should feel, but which is not an
   * emergency — "Tell my circle". Warning rather than Success: it is not a
   * celebration, and not Error: nothing went wrong.
   */
  nonEmergencySent(): void {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
};
