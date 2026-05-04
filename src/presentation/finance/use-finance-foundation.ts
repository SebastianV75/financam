import { useEffect, useMemo, useState } from 'react';

import {
  createOperationalMovement,
  getFinanceFoundation,
  getPayrollDistribution,
  getPlanningSnapshot,
} from '@/application/finance';
import { SQLiteFinanceRepository } from '@/infrastructure/repositories/sqlite-finance-repository';
import { toDatabaseClient } from '@/infrastructure/db/client';
import { useDatabaseContext } from '@/infrastructure/db/provider';

type ViewState = 'idle' | 'loading' | 'ready' | 'error';

interface CreateMovementInput {
  kind: 'income' | 'expense' | 'transfer';
  amount: number;
}

interface UseFinanceFoundationOptions {
  mode?: 'plan' | 'movements';
}

export function useFinanceFoundation(options: UseFinanceFoundationOptions = {}) {
  const mode = options.mode ?? 'movements';
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
  const [activeQuincena, setActiveQuincena] = useState<{ id: string; label: string; startsAt: string; endsAt: string } | null>(
    null,
  );
  const [payrollDistribution, setPayrollDistribution] = useState<Awaited<ReturnType<typeof getPayrollDistribution>>>(null);
  const [planningSummary, setPlanningSummary] = useState({ plans: 0, projections: 0 });

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
        const result = await getFinanceFoundation(activeRepository);

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
        setActiveQuincena(result.quincena);
        const distribution = await getPayrollDistribution(activeRepository, { quincenaId: result.quincena.id });
        if (!isMounted) return;
        setPayrollDistribution(distribution);
        if (mode === 'plan') {
          const planning = await getPlanningSnapshot(activeRepository, { date: new Date() });
          if (!isMounted) return;
          setPlanningSummary({ plans: planning.plans.length, projections: planning.projections.length });
        } else {
          setPlanningSummary({ plans: 0, projections: 0 });
        }
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
  }, [mode, repository]);

  async function createQuickMovement(input: CreateMovementInput) {
    if (!repository) throw new Error('Repositorio no inicializado.');
    if (!activeQuincena) throw new Error('Quincena activa no disponible.');
    if (accounts.length === 0) throw new Error('Se requiere al menos una cuenta.');
    if ((input.kind === 'income' || input.kind === 'expense') && categories.length === 0) {
      throw new Error('Se requiere al menos una categoría para ingreso o gasto.');
    }

    const [first, second] = accounts;
    const firstCategory = categories[0] ?? null;

    await createOperationalMovement(repository, {
      id: `${input.kind}-${Date.now()}`,
      quincenaId: activeQuincena.id,
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

    const refreshed = await getFinanceFoundation(repository);
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
    setActiveQuincena(refreshed.quincena);
    const distribution = await getPayrollDistribution(repository, { quincenaId: refreshed.quincena.id });
    setPayrollDistribution(distribution);
  }

  if (!activeQuincena && state === 'ready') {
    throw new Error('No se pudo resolver quincena activa.');
  }

  return {
    summary,
    accounts,
    categories,
    balances,
    movements,
    payrollDistribution,
    planningSummary,
    activeQuincena,
    createQuickMovement,
    error,
    state,
  };
}
