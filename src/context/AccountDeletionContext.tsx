import React, { createContext, useContext, useMemo } from 'react';

import type { AccountDeletionService, AccountDeletionResult } from '../services/AccountDeletionService';

interface AccountDeletionContextValue {
  deleteAccount(userId: string): Promise<AccountDeletionResult>;
}

const NOOP_RESULT: AccountDeletionResult = {
  success: false,
  requiresRecentAuth: false,
  partialErrors: [],
  error: 'AccountDeletionService not initialised.',
};

export const AccountDeletionContext = createContext<AccountDeletionContextValue>({
  deleteAccount: async () => NOOP_RESULT,
});

export function AccountDeletionStateProvider({
  accountDeletionService,
  children,
}: {
  accountDeletionService: AccountDeletionService;
  children: React.ReactNode;
}) {
  const value = useMemo<AccountDeletionContextValue>(
    () => ({ deleteAccount: (uid) => accountDeletionService.deleteAccount(uid) }),
    [accountDeletionService],
  );

  return (
    <AccountDeletionContext.Provider value={value}>
      {children}
    </AccountDeletionContext.Provider>
  );
}

export function useAccountDeletionContext(): AccountDeletionContextValue {
  return useContext(AccountDeletionContext);
}
