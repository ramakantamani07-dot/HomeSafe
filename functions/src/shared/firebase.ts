import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

/**
 * The Admin SDK singletons, initialised exactly once.
 *
 * `initializeApp()` must not run twice in a process. Every module that needs
 * Firestore or FCM imports from here rather than calling it again — Node's
 * module cache is what guarantees the single call, so this file must stay the
 * only place it appears.
 */
initializeApp();

export const db = getFirestore();
export const messaging = getMessaging();
