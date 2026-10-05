/**
 * Cloud Functions entry point — re-exports only.
 *
 * Firebase discovers functions by **exported name**, so every trigger must be
 * re-exported from this file under exactly the name it was deployed with.
 * Renaming an export tears down the old function and creates a new one, which
 * for a scheduled or HTTP trigger means downtime and a changed URL.
 *
 * Implementation lives in the feature folders:
 *
 *   shared/     Admin SDK singletons, stored document shapes, FCM delivery,
 *               batched deletes
 *   alerts/     guardian notification triggers
 *   checkins/   server-side missed-check-in backstop
 *   safety/     server-side safety-check escalation backstop
 *   retention/  data retention and account deletion
 *   sharing/    public guardian tracking link
 *
 * Side-effect import order matters only in that `shared/firebase` must be
 * initialised before anything touches Firestore; every module imports it, and
 * Node's module cache makes that a single `initializeApp()`.
 */

export { onSOSTriggered, onMissedCheckIn, onSafetyCheckEscalated } from './alerts';
export { detectMissedCheckIns } from './checkins';
export { escalateOverdueSafetyChecks } from './safety';
export { enforceDataRetention, onUserAccountDeleted } from './retention';
export { getSharedJourney } from './sharing';
