import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { DataExportProvider } from '../providers/DataExportProvider';
import type { StorageProvider } from '../providers/StorageProvider';

export interface DataExportResult {
  success: boolean;
  error?: string;
}

/**
 * GDPR Art. 20 / DPDP data-portability — the export counterpart to
 * AccountDeletionService, reusing the same collections (contacts, journeys +
 * their locationUpdates/checkIns, sosEvents) but reading instead of deleting.
 * The local profile (name, phone, settings) is read from SecureStore via
 * StorageProvider — it was never in Firestore to begin with (see
 * docs/reference/SECURITY_REVIEW.md), so DataExportProvider alone wouldn't see it.
 *
 * Writes a JSON file to the cache directory and hands it to the OS share
 * sheet — the user picks where it actually ends up (Files, email, AirDrop,
 * etc.). Nothing is uploaded anywhere; this device never sends the export
 * to wayLoc's own servers, only reads what's already there.
 */
export class DataExportService {
  constructor(
    private readonly exportProvider: DataExportProvider,
    private readonly storageProvider: StorageProvider,
  ) {}

  async exportMyData(userId: string): Promise<DataExportResult> {
    try {
      const [profile, contacts, journeys, sosEvents] = await Promise.all([
        this.storageProvider.getUser(userId),
        this.exportProvider.exportContacts(userId),
        this.exportProvider.exportJourneys(userId),
        this.exportProvider.exportSosEvents(userId),
      ]);

      const payload = {
        exportedAt: new Date().toISOString(),
        profile: profile
          ? { name: profile.name, phone: profile.phone, settings: profile.settings }
          : null,
        contacts,
        journeys,
        sosEvents,
      };

      const file = new File(Paths.cache, `wayloc-data-export-${Date.now()}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(JSON.stringify(payload, null, 2));

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        return { success: false, error: 'Sharing is not available on this device.' };
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Save your wayLoc data',
      });

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Could not export your data.',
      };
    }
  }
}
