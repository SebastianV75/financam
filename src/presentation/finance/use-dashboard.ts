import { useCallback, useEffect, useMemo, useState } from 'react';

import { getDashboardSummary } from '@/application/finance';
import type { DashboardSummary } from '@/domain/finance';
import { toDatabaseClient } from '@/infrastructure/db/client';
import { useDatabaseContext } from '@/infrastructure/db/provider';
import { SQLiteFinanceRepository } from '@/infrastructure/repositories/sqlite-finance-repository';

export function useDashboard() {
  const { db } = useDatabaseContext();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const repository = useMemo(() => {
    if (!db) return null;
    return new SQLiteFinanceRepository(toDatabaseClient(db));
  }, [db]);

  const refresh = useCallback(async () => {
    if (!repository) return;

    try {
      setLoading(true);
      const nextSummary = await getDashboardSummary(repository);
      setSummary(nextSummary);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el dashboard.');
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    summary,
    loading,
    error,
    refresh,
  };
}
