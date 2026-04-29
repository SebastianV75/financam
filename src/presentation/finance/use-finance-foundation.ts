import { useEffect, useMemo, useState } from 'react';

import { getFinanceFoundation } from '@/application/finance';
import { SQLiteFinanceRepository } from '@/infrastructure/repositories/sqlite-finance-repository';
import { toDatabaseClient } from '@/infrastructure/db/client';
import { useDatabaseContext } from '@/infrastructure/db/provider';

type ViewState = 'idle' | 'loading' | 'ready' | 'error';

export function useFinanceFoundation(quincenaId: string) {
  const { db } = useDatabaseContext();
  const [state, setState] = useState<ViewState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({ plan: 0, movements: 0 });

  const repository = useMemo(() => {
    if (!db) return null;
    return new SQLiteFinanceRepository(toDatabaseClient(db));
  }, [db]);

  useEffect(() => {
    if (!repository) return;

    const activeRepository = repository;

    let isMounted = true;

    async function load() {
      try {
        setState('loading');
        const result = await getFinanceFoundation(activeRepository, { quincenaId });

        if (!isMounted) return;

        setCounts({
          plan: result.plan.length,
          movements: result.movements.length,
        });
        setError(null);
        setState('ready');
      } catch (loadError) {
        if (!isMounted) return;

        setState('error');
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la base financiera.');
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [quincenaId, repository]);

  return { counts, error, state };
}
