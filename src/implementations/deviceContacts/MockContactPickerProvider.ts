import type { ContactPickerProvider, PickedContact } from '../../providers/ContactPickerProvider';

/** A fixed pick, so the Invite flow is exercisable where no picker exists. */
export class MockContactPickerProvider implements ContactPickerProvider {
  readonly isAvailable = true;

  constructor(private readonly contact: PickedContact | null = { name: 'Priya Sharma', phoneNumbers: ['+91 98765 43210'] }) {}

  async pick(): Promise<PickedContact | null> {
    return this.contact;
  }
}
