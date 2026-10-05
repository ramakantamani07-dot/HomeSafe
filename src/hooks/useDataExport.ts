import { useState } from 'react';

import { useAuthContext } from '../context/AuthContext';
import { useDataExportContext } from '../context/DataExportContext';
import type { DataExportResult } from '../services/DataExportService';

export type DataExportStage = 'idle' | 'exporting' | 'done' | 'error';

export interface UseDataExport {
  stage: DataExportStage;
  error: string | null;
  /**
   * Returns the result directly rather than relying on callers reading
   * `error`/`stage` right after awaiting — those are React state and won't
   * reflect this call's outcome until the next render.
   */
  exportMyData(): Promise<DataExportResult>;
  reset(): void;
}

const NOT_SIGNED_IN_RESULT: DataExportResult = { success: false, error: 'Not signed in.' };

export function useDataExport(): UseDataExport {
  const { user } = useAuthContext();
  const { exportMyData: exportMyDataRequest } = useDataExportContext();

  const [stage, setStage] = useState<DataExportStage>('idle');
  const [error, setError] = useState<string | null>(null);

  const exportMyData = async (): Promise<DataExportResult> => {
    if (!user?.id) return NOT_SIGNED_IN_RESULT;
    setStage('exporting');
    setError(null);

    const result = await exportMyDataRequest(user.id);

    if (result.success) {
      setStage('done');
    } else {
      setStage('error');
      setError(result.error ?? 'Could not export your data.');
    }
    return result;
  };

  const reset = (): void => {
    setStage('idle');
    setError(null);
  };

  return { stage, error, exportMyData, reset };
}
