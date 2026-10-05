/**
 * Read-side counterpart to AccountDeletionProvider — same collections,
 * read instead of deleted. Kept as a separate interface rather than adding
 * read methods to AccountDeletionProvider: that interface is deliberately
 * delete-only, and mixing concerns there would make it easy to misuse a
 * "delete" abstraction for a read path by accident.
 */
export interface DataExportProvider {
  /** All contact documents for the user, as plain field maps (already JSON-safe: dates as ISO strings). */
  exportContacts(userId: string): Promise<Record<string, unknown>[]>;

  /**
   * All journeys for the user (any status), each with its locationUpdates
   * and checkIns nested inline. Paginated internally for journeys with large
   * location histories — callers get the fully assembled result.
   */
  exportJourneys(userId: string): Promise<Record<string, unknown>[]>;

  /** All SOS event documents for the user. */
  exportSosEvents(userId: string): Promise<Record<string, unknown>[]>;
}
