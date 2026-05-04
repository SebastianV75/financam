import type { FinanceRepository } from '@/domain/finance';

import { ensureCurrentQuincena } from './ensure-current-quincena';

export async function getFinanceFoundation(
  repository: FinanceRepository,
  input?: { date?: Date },
) {
  const quincena = await ensureCurrentQuincena(repository, input?.date ?? new Date());

  const [accounts, categories, movements, balances, goals, debts] = await Promise.all([
    repository.listAccounts(),
    repository.listCategories(),
    repository.listMovementsByQuincena(quincena.id),
    repository.getAccountBalances(),
    repository.listSavingsGoals(),
    repository.listDebts(),
  ]);

  return {
    quincena,
    accounts,
    categories,
    movements,
    balances,
    goals,
    debts,
  };
}
