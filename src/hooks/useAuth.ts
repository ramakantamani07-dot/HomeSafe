import { useAuthContext } from '../context/AuthContext';

/**
 * Primary auth hook for screens.
 * Screens must only interact with auth through this hook — never
 * import AuthService, AuthProvider, or FirebaseAuthProvider directly.
 */
export function useAuth() {
  return useAuthContext();
}
