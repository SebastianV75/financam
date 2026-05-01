import { useEffect, useMemo, useState } from 'react';

import { createOperationalMovement, getFinanceFoundation } from '@/application/finance';
import { SQLiteFinanceRepository } from '@/infrastructure/repositories/sqlite-finance-repository';
import { toDatabaseClient } from '@/infrastructure/db/client';
import { useDatabaseContext } from '@/infrastructure/db/provider';

type ViewState = 'idle' | 'loading' | 'ready' | 'error';

interface CreateMovementInput {
  kind: 'income' | 'expense' | 'transfer';
  amount: number;
}

export function useFinanceFoundation(quincenaId: string) {
  const { db } = useDatabaseContext();
  const [state, setState] = useState<ViewState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({ accounts: 0, categories: 0, movements: 0, balances: 0 });
  const [accounts, setAccounts] = useState<Awaited<ReturnType<SQLiteFinanceRepository['listAccounts']>>>([]);
  const [categories, setCategories] = useState<Awaited<ReturnType<SQLiteFinanceRepository['listCategories']>>>([]);
  const [balances, setBalances] = useState<Awaited<ReturnType<SQLiteFinanceRepository['getAccountBalances']>>>([]);
  const [movements, setMovements] = useState<
    Awaited<ReturnType<SQLiteFinanceRepository['listMovementsByQuincena']>>
  >([]);

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

        setSummary({
          accounts: result.accounts.length,
          categories: result.categories.length,
          movements: result.movements.length,
          balances: result.balances.length,
        });
        setAccounts(result.accounts);
        setCategories(result.categories);
        setBalances(result.balances);
        setMovements(result.movements);
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

  async function createQuickMovement(input: CreateMovementInput) {
    if (!repository) throw new Error('Repositorio no inicializado.');
    if (accounts.length === 0) throw new Error('Se requiere al menos una cuenta.');
    if ((input.kind === 'income' || input.kind === 'expense') && categories.length === 0) {
      throw new Error('Se requiere al menos una categoría para ingreso o gasto.');
    }

    const [first, second] = accounts;
    const firstCategory = categories[0] ?? null;

    await createOperationalMovement(repository, {
      id: `${input.kind}-${Date.now()}`,
      quincenaId,
      occurredAt: new Date().toISOString(),
      kind: input.kind,
      amount: { amount: input.amount, currency: 'MXN' },
      fromAccountId: input.kind === 'expense' || input.kind === 'transfer' ? first.id : null,
      toAccountId:
        input.kind === 'income'
          ? first.id
          : input.kind === 'transfer'
            ? (second?.id ?? null)
            : null,
      categoryId: input.kind === 'transfer' ? null : firstCategory?.id ?? null,
      note: 'captura rápida UI',
    });

    const refreshed = await getFinanceFoundation(repository, { quincenaId });
    setSummary({
      accounts: refreshed.accounts.length,
      categories: refreshed.categories.length,
      movements: refreshed.movements.length,
      balances: refreshed.balances.length,
    });
    setAccounts(refreshed.accounts);
    setCategories(refreshed.categories);
    setBalances(refreshed.balances);
    setMovements(refreshed.movements);
  }

  return { summary, accounts, categories, balances, movements, createQuickMovement, error, state };
}
