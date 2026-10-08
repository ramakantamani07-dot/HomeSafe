/**
 * The client and the Cloud Functions each carry a copy of the consent rules,
 * because `functions/` shares no module graph with the app. The server copy
 * enforces; the client copy predicts, so the UI can be honest about what the
 * server will say. If they ever disagree, either a screen lies or a lookup is
 * permitted that the app believes is refused.
 *
 * So the copies are compared here, exhaustively, rather than kept in sync by
 * hand. Both files are pure, which is what makes importing the server one into
 * the app suite safe.
 */
import * as server from '../../functions/src/networkLocation/consent';
import * as serverConfig from '../../functions/src/networkLocation/config';
import { applyConsentEvent, type ConsentEventKind } from '../services/ConsentStateMachine';
import { CONSENT_KEYWORDS, parseConsentReply } from '../models/ConsentKeywords';
import { LOCATE_LIMIT_PER_HOUR, LOCATE_MIN_INTERVAL_MS, isRateLimited } from '../models/LocateAudit';
import {
  CONSENT_REQUEST_TTL_MS,
  CONSENT_RESEND_LIMIT,
  CONSENT_RESEND_MIN_INTERVAL_MS,
  allowsLocationLookup,
  isTerminal,
} from '../models/Consent';

describe('consent rules: client and server agree', () => {
  it('on every state × event', () => {
    for (const from of server.CONSENT_STATUSES) {
      for (const event of server.CONSENT_EVENT_KINDS) {
        expect([from, event, server.applyConsentEvent(from, event)]).toEqual([
          from,
          event,
          applyConsentEvent(from, event as ConsentEventKind),
        ]);
      }
    }
  });

  it('on what permits a lookup and what is terminal', () => {
    for (const status of server.CONSENT_STATUSES) {
      expect(server.allowsLocationLookup(status)).toBe(allowsLocationLookup(status));
      expect(server.isTerminal(status)).toBe(isTerminal(status));
    }
  });

  it('on the keyword lists', () => {
    expect(server.CONSENT_KEYWORDS).toEqual(CONSENT_KEYWORDS);
  });

  it('on how replies are read', () => {
    const samples = [
      'YES', ' yes! ', 'haan', 'हाँ', 'no', 'NAHIN', 'please stop', 'STOP', 'yes stop',
      'yes if you must', 'band karo', '', 'ok.', '"Y"', 'unsubscribe me',
    ];
    for (const s of samples) {
      expect([s, server.parseConsentReply(s)]).toEqual([s, parseConsentReply(s)]);
    }
  });

  it('on the rate limit', () => {
    expect(server.LOCATE_LIMIT_PER_HOUR).toBe(LOCATE_LIMIT_PER_HOUR);
    expect(server.LOCATE_MIN_INTERVAL_MS).toBe(LOCATE_MIN_INTERVAL_MS);

    const now = new Date('2026-10-07T12:00:00Z');
    const ago = (min: number) => new Date(now.getTime() - min * 60_000);
    const histories = [
      [],
      [ago(0.5)],
      [ago(1.5)],
      [ago(5), ago(10), ago(15), ago(20), ago(25), ago(30)],
      [ago(61), ago(62), ago(63), ago(64), ago(65), ago(66)],
    ];
    for (const h of histories) {
      expect(server.isRateLimited(h, now)).toBe(isRateLimited(h, now));
    }
  });

  it('on the request deadline and the resend limits', () => {
    expect(serverConfig.CONSENT_REQUEST_TTL_MS).toBe(CONSENT_REQUEST_TTL_MS);
    expect(serverConfig.CONSENT_RESEND_LIMIT).toBe(CONSENT_RESEND_LIMIT);
    expect(serverConfig.CONSENT_RESEND_MIN_INTERVAL_MS).toBe(CONSENT_RESEND_MIN_INTERVAL_MS);
  });
});
