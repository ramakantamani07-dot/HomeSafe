import type { AccountDeletionProvider } from '../../providers/AccountDeletionProvider';

export class MockAccountDeletionProvider implements AccountDeletionProvider {
  async listAllJourneyIds(_userId: string): Promise<string[]> { return []; }
  async deleteJourneySubCollections(_userId: string, _journeyId: string): Promise<void> {}
  async deleteJourney(_userId: string, _journeyId: string): Promise<void> {}
  async deleteAllContacts(_userId: string): Promise<void> {}
  async deleteAllSosEvents(_userId: string): Promise<void> {}
  async deleteUserDocument(_userId: string): Promise<void> {}
  async removeDeviceToken(_userId: string): Promise<void> {}
}
