import * as logger from 'firebase-functions/logger';

import { db } from '../shared/firebase';
import type { StoredUser } from '../shared/types';
import {
  dltTemplateId,
  guardianDisplayName,
  isMarketEnabled,
  marketForNumber,
  renderSms,
  type SmsDetails,
  type SmsTemplate,
} from './config';
import type { NetworkLocationAdapters } from './ports';

/** The guardian's name as the member will read it. */
export async function guardianNameFor(ownerId: string): Promise<string> {
  const snap = await db.doc(`users/${ownerId}`).get();
  return guardianDisplayName((snap.data() as StoredUser | undefined)?.name);
}

/**
 * Texts a member. Returns whether it was handed to the provider.
 *
 * Refuses, rather than throws, for a market that is switched off: the flag is
 * the decision that we may not contact people there yet, and that is an
 * expected answer rather than a failure. A provider error does throw, so the
 * caller decides whether it is worth retrying.
 */
export async function sendMemberSms(
  adapters: NetworkLocationAdapters,
  to: string,
  template: SmsTemplate,
  guardianName: string,
  details?: SmsDetails,
): Promise<boolean> {
  const market = marketForNumber(to);
  if (!market || !isMarketEnabled(market)) {
    logger.info('Member SMS not sent: market disabled', { template, market });
    return false;
  }
  await adapters.sms.send({
    to,
    market,
    template,
    body: renderSms(template, guardianName, details),
    dltTemplateId: dltTemplateId(template, market),
  });
  return true;
}
