/**
 * Network location for basic-phone members (Phase 6.3).
 *
 *   consent.ts         pure rules — mirrors the client, parity-tested
 *   planning.ts        pure decisions for the webhook and locate
 *   config.ts          markets, feature flag (off by default), SMS wording
 *   ports.ts           SMS / operator / consent-strategy interfaces
 *   mockAdapters.ts    the only adapters until G3 names providers
 *   store.ts           the one transactional way a consent changes
 */
export { requestConsentSms, resendConsentRequest } from './requestConsent';
export { inboundConsentSms } from './inboundSms';
export { locateMember } from './locate';
export { onConsentRevoked } from './revocation';
