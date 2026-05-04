import type { FinanceRepository } from '@/domain/finance';

import { ensureCurrentQuincena } from './ensure-current-quincena';
import { listFinancialPlans } from './list-financial-plans';
import { listFixedExpenseProjections } from './list-fixed-expense-projections';

export async function getPlanningSnapshot(repository: FinanceRepository, input?: { date?: Date }) {
  const quincena = await ensureCurrentQuincena(repository, input?.date ?? new Date());
  const [plans, projections] = await Promise.all([
    listFinancialPlans(repository, { quincenaId: quincena.id }),
    listFixedExpenseProjections(repository, { quincenaId: quincena.id }),
  ]);

  return {
    quincena,
    plans,
    projections,
  };
}
