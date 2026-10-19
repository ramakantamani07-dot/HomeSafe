import * as Clipboard from 'expo-clipboard';

/**
 * Copies text the person asked to copy — the destination's address, so it can
 * be pasted into a ride app WayLoc cannot fill in itself (Rapido, a friend's
 * phone). Only ever on a tap; WayLoc never reads the clipboard.
 *
 * Resolves false rather than throwing: a failed copy is told to the person,
 * it is not an error to crash on.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    return await Clipboard.setStringAsync(text);
  } catch {
    return false;
  }
}
