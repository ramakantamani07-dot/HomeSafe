import type { DataExportProvider } from '../../providers/DataExportProvider';

export class MockDataExportProvider implements DataExportProvider {
  async exportContacts(_userId: string): Promise<Record<string, unknown>[]> {
    return [
      { id: 'mock-contact-1', name: 'Alex', phone: '+919876543210', relationship: 'Friend' },
    ];
  }

  async exportJourneys(_userId: string): Promise<Record<string, unknown>[]> {
    return [
      {
        id: 'mock-journey-1',
        destinationLabel: 'Home',
        status: 'COMPLETED',
        locationUpdates: [],
        checkIns: [],
      },
    ];
  }

  async exportSosEvents(_userId: string): Promise<Record<string, unknown>[]> {
    return [];
  }
}
