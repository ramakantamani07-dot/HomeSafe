import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ApplicationVerifier } from 'firebase/auth';

import type { User } from '../models/User';
import type { AuthService } from '../services/AuthService';
import type { AuthProvider } from '../providers/AuthProvider';
import {
  clearSecureSession,
  getSecureSessionUser,
  saveSecureSession,
} from '../implementations/session/SecureSessionStore';

// Providers that need UI-level reCAPTCHA (Firebase) expose this method.
// MockAuthProvider and future providers that don't need it simply omit it.
type AuthProviderWithVerifier = AuthProvider & {
  setAppVerifier?: (verifier: ApplicationVerifier) => void;
};

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isDevMode: boolean;
  sendOTP: (phone: string) => Promise<void>;
  verifyOTP: (code: string) => Promise<void>;
  updateProfile: (updates: Partial<Omit<User, 'id' | 'phone' | 'createdAt'>>) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * null when using MockAuthProvider (dev mode) — screens check this before
   * rendering the Firebase reCAPTCHA modal.
   */
  configureRecaptchaVerifier: ((verifier: ApplicationVerifier) => void) | null;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isDevMode: false,
  sendOTP: async () => {},
  verifyOTP: async () => {},
  updateProfile: async () => {},
  signOut: async () => {},
  configureRecaptchaVerifier: null,
});

export function AuthStateProvider({
  authService,
  authProvider,
  isDevMode,
  children,
}: {
  authService: AuthService;
  authProvider: AuthProviderWithVerifier;
  isDevMode: boolean;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadingFallback = setTimeout(() => {
      if (mounted) {
        setIsLoading(false);
      }
    }, 2500);

    getSecureSessionUser().then((cachedUser) => {
      if (mounted && cachedUser) {
        setUser(cachedUser);
      }
    });

    const unsubscribe = authService.onAuthStateChanged(async (nextUser) => {
      clearTimeout(loadingFallback);
      let resolvedUser = nextUser;

      if (nextUser) {
        resolvedUser = (await authService.getCurrentUser()) ?? nextUser;
        await saveSecureSession(resolvedUser);
      } else {
        await clearSecureSession();
      }
      if (!mounted) {
        return;
      }
      setUser(resolvedUser);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(loadingFallback);
      unsubscribe();
    };
  }, [authService]);

  const sendOTP = useCallback<AuthContextValue['sendOTP']>(
    (phone) => authService.sendOTP(phone),
    [authService],
  );

  const verifyOTP = useCallback<AuthContextValue['verifyOTP']>(async (code) => {
    const loggedInUser = await authService.verifyOTP(code);
    await saveSecureSession(loggedInUser);
    setUser(loggedInUser);
  }, [authService]);

  const updateProfile = useCallback<AuthContextValue['updateProfile']>(async (updates) => {
    if (!user) throw new Error('Sign in before updating your profile.');
    const updatedUser = await authService.updateUserProfile(user.id, updates);
    await saveSecureSession(updatedUser);
    setUser(updatedUser);
  }, [user, authService]);

  const signOut = useCallback<AuthContextValue['signOut']>(async () => {
    await authService.signOut();
    await clearSecureSession();
    setUser(null);
  }, [authService]);

  const configureRecaptchaVerifier = useMemo<AuthContextValue['configureRecaptchaVerifier']>(
    () =>
      authProvider.setAppVerifier
        ? (verifier) => authProvider.setAppVerifier!(verifier)
        : null,
    [authProvider],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isDevMode,
      sendOTP,
      verifyOTP,
      updateProfile,
      signOut,
      configureRecaptchaVerifier,
    }),
    [
      user,
      isLoading,
      isDevMode,
      sendOTP,
      verifyOTP,
      updateProfile,
      signOut,
      configureRecaptchaVerifier,
    ],
  );


  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  return useContext(AuthContext);
}
