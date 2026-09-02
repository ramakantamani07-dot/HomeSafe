import React, { forwardRef } from 'react';
import type { ApplicationVerifier } from 'firebase/auth';

import { firebaseConfig } from '../../config/firebase';

type FirebaseRecaptchaVerifierProps = {
  enabled: boolean;
};

export type FirebaseRecaptchaVerifierHandle = ApplicationVerifier;

export const FirebaseRecaptchaVerifier = forwardRef<
  FirebaseRecaptchaVerifierHandle,
  FirebaseRecaptchaVerifierProps
>(function FirebaseRecaptchaVerifier({ enabled }, ref) {
  if (!enabled) {
    return null;
  }

  const RecaptchaModal = require('expo-firebase-recaptcha').FirebaseRecaptchaVerifierModal;

  return (
    <RecaptchaModal
      ref={ref}
      firebaseConfig={firebaseConfig}
    />
  );
});
