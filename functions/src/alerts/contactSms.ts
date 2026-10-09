import * as logger from 'firebase-functions/logger';

import { getAdapters } from '../networkLocation/adapters';
import { dltTemplateId, isMarketEnabled, marketForNumber, type SmsTemplate } from '../networkLocation/config';
import { metric } from '../shared/metrics';

/**
 * Texts trusted contacts who cannot be reached by push (Phase 5c).
 *
 * Uses the same SMS adapter as network location — one SMS stack, not two —
 * and the same per-market switch: until an SMS provider exists for a market
 * (G3), nothing is sent there, and the app does not claim it is.
 *
 * Returns how many texts were handed to the provider.
 */
export async function textContacts(phones: string[], template: SmsTemplate, body: string): Promise<number> {
  const adapters = getAdapters();
  if (!adapters || phones.length === 0) return 0;

  const results = await Promise.allSettled(
    phones.map(async (to) => {
      const market = marketForNumber(to);
      if (!market || !isMarketEnabled(market)) return false;
      await adapters.sms.send({ to, market, template, body, dltTemplateId: dltTemplateId(template, market) });
      return true;
    }),
  );
  const sent = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  const failed = results.filter((r) => r.status === 'rejected').length;
  if (failed > 0) logger.error('Contact SMS failed', { template, failed });
  metric('contact_sms', { template, requested: phones.length, sent, failed });
  return sent;
}

/** "https://maps.google.com/?q=…" for a text — a link, never bare coordinates. */
export function mapLink(location: { latitude: number; longitude: number } | null | undefined): string | null {
  return location
    ? `https://maps.google.com/?q=${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}`
    : null;
}
