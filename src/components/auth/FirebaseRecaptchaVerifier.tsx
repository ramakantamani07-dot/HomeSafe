import React from 'react';
import type { ApplicationVerifier } from 'firebase/auth';

type FirebaseRecaptchaVerifierProps = {
  enabled: boolean;
};

export type FirebaseRecaptchaVerifierHandle = ApplicationVerifier;

/**
 * Placeholder for the phone-auth verifier. Renders nothing.
 *
 * **Why it is empty.** Firebase's JS SDK does phone auth through a
 * `RecaptchaVerifier`, which needs a DOM — its React Native entry point does
 * not even export one. `expo-firebase-recaptcha` bridged that with a WebView,
 * but it was last published in **October 2022**, is absent from Expo SDK 54's
 * supported modules, and its transitive `expo-firebase-core` breaks `pod
 * install` outright. Both were removed rather than worked around; see
 * docs/architecture/DEPENDENCIES.md.
 *
 * **What replaces it.** When real phone auth is wired up — which needs a
 * Firebase project and `GoogleService-Info.plist` / `google-services.json`
 * anyway — use `@react-native-firebase/auth`. It verifies natively (silent
 * APNs on iOS, Play Integrity on Android), so there is no reCAPTCHA puzzle at
 * all: better for the user and harder to spoof than a WebView challenge.
 *
 * The component and the `ApplicationVerifier` seam are kept so the auth port
 * and both auth screens are untouched by that migration.
 */
export function FirebaseRecaptchaVerifier(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _props: FirebaseRecaptchaVerifierProps & { ref?: React.Ref<FirebaseRecaptchaVerifierHandle> },
) {
  return null;
}
