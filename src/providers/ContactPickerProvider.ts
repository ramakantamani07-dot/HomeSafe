/**
 * Choosing one person from the phone's contacts (Phase 5b, Invite someone).
 *
 * A picker, not an address-book reader. The OS shows its own contact list,
 * out of the app's process; the app receives only the person chosen. That is
 * both the private way to do this and what decision F1 rests on: a number
 * that came back from here provably came from the inviter's own contacts.
 */
export interface PickedContact {
  name: string;
  /** As stored in the contact — not yet normalised. May be empty. */
  phoneNumbers: string[];
}

export interface ContactPickerProvider {
  /** Whether a picker exists on this device/build. Hides the button when not. */
  readonly isAvailable: boolean;
  /** Null when the person cancels, or picks someone with no number. */
  pick(): Promise<PickedContact | null>;
}
