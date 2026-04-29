import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';

import { openFinanceDatabase } from './client';
import { bootstrapDatabase } from './bootstrap';

type DatabaseStatus = 'loading' | 'ready' | 'error';

interface DatabaseContextValue {
  db: SQLiteDatabase | null;
  status: DatabaseStatus;
  error: string | null;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export function DatabaseProvider({ children }: PropsWithChildren) {
  const [value, setValue] = useState<DatabaseContextValue>({
    db: null,
    status: 'loading',
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        const db = await openFinanceDatabase();
        await bootstrapDatabase(db);

        if (!isMounted) return;

        setValue({ db, status: 'ready', error: null });
      } catch (error) {
        if (!isMounted) return;

        const message = error instanceof Error ? error.message : 'Error desconocido al iniciar SQLite.';

        setValue({ db: null, status: 'error', error: message });
      }
    }

    initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  const contextValue = useMemo(() => value, [value]);

  return <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>;
}

export function useDatabaseContext() {
  const context = useContext(DatabaseContext);

  if (!context) {
    throw new Error('useDatabaseContext debe usarse dentro de DatabaseProvider.');
  }

  return context;
}
