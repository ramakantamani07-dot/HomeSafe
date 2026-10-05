import React, { createContext, useContext, useMemo } from 'react';

import type { DataExportService, DataExportResult } from '../services/DataExportService';

interface DataExportContextValue {
  exportMyData(userId: string): Promise<DataExportResult>;
}

const NOOP_RESULT: DataExportResult = {
  success: false,
  error: 'DataExportService not initialised.',
};

export const DataExportContext = createContext<DataExportContextValue>({
  exportMyData: async () => NOOP_RESULT,
});

export function DataExportStateProvider({
  dataExportService,
  children,
}: {
  dataExportService: DataExportService;
  children: React.ReactNode;
}) {
  const value = useMemo<DataExportContextValue>(
    () => ({ exportMyData: (uid) => dataExportService.exportMyData(uid) }),
    [dataExportService],
  );

  return (
    <DataExportContext.Provider value={value}>
      {children}
    </DataExportContext.Provider>
  );
}

export function useDataExportContext(): DataExportContextValue {
  return useContext(DataExportContext);
}
