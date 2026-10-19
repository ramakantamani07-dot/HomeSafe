import { Linking } from 'react-native';

import type { LinkOpener } from '../../providers/RideAppProvider';

/**
 * `Linking.openURL` resolves once iOS / Android has handed the link on, and
 * rejects when nothing can open it — an app link to an app that is not
 * installed. `canOpenURL` is deliberately not asked first: opening needs no
 * declared schemes, while asking would (`LSApplicationQueriesSchemes` on iOS,
 * `<queries>` on Android) — a native rebuild for an answer `openURL` already
 * gives.
 */
export class ReactNativeLinkOpener implements LinkOpener {
  async open(url: string): Promise<boolean> {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      return false;
    }
  }
}
