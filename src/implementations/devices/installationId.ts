import { getItem, setItem } from '../storage/secureStorage';

const KEY = 'wayloc.installationId';

/**
 * This installation's id, created once and kept in the phone's secure
 * storage. On iOS the keychain keeps it across a reinstall, so reinstalling
 * on the same iPhone is not a "new phone"; on Android a reinstall starts over,
 * which the warning's wording allows for.
 *
 * Random, not derived from the hardware: it identifies an install to this
 * account, nothing more.
 */
export async function installationId(): Promise<string> {
  const existing = await getItem(KEY);
  if (existing) return existing;
  const id = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join('');
  await setItem(KEY, id);
  return id;
}
