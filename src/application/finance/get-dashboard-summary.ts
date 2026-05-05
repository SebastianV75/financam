import type { DashboardSummary, DashboardDebtSummary, DashboardGoalSummary, FinanceRepository } from '@/domain/finance';

import { DEFAULT_CURRENCY } from '@/shared/constants/app';
import { calculateDashboardRemainingV1, classifyEligibleExpenseMovements, deriveDashboardState } from '@/domain/finance/rules/dashboard';

import { ensureCurrentQuincena } from './ensure-current-quincena';

export async function getDashboardSummary(repository: FinanceRepository, input?: { date?: Date }): Promise<DashboardSummary> {
  const quincena = await ensureCurrentQuincena(repository, input?.date ?? new Date());

  const [balances, debts, distribution, plans, projections, movements, goals] = await Promise.all([
    repository.getAccountBalances(),
    repository.listDebts(),
    repository.getPayrollDistributionByQuincena(quincena.id),
    repository.listFinancialPlansByQuincena(quincena.id),
    repository.listFixedExpenseProjectionsByQuincena(quincena.id),
    repository.listMovementsByQuincena(quincena.id),
    repository.listSavingsGoals(),
  ]);

  const [debtSummariesRaw, goalSummariesRaw] = await Promise.all([
    Promise.all(debts.map((debt) => repository.getDebtSummary(debt.id))),
    Promise.all(goals.map((goal) => repository.getSavingsGoalSummary(goal.id, quincena.endsAt))),
  ]);

  const liquidity = balances.reduce((sum, item) => sum + item.balance.amount, 0);
  const debtTotal = debts.filter((debt) => debt.status === 'active').reduce((sum, debt) => sum + debt.currentBalance.amount, 0);
  const netWorth = liquidity - debtTotal;

  const income = distribution?.status === 'applied' ? distribution.total.amount : 0;
  const plannedVariable = plans.filter((plan) => !plan.isFixed).reduce((sum, plan) => sum + plan.planned.amount, 0);
  const committedFixed = projections.reduce((sum, projection) => sum + projection.amount.amount, 0);
  const actualExpense = classifyEligibleExpenseMovements(movements).reduce((sum, movement) => sum + movement.amount.amount, 0);

  const remaining = calculateDashboardRemainingV1({ income, plannedVariable, committedFixed, actualExpense });
  const stateMeta = deriveDashboardState({ income, plannedVariable, committedFixed });

  const goalSummaryById = new Map(goalSummariesRaw.map((summary) => [summary.goalId, summary]));
  const goalsSummary: DashboardGoalSummary[] = goals.map((goal) => {
    const summary = goalSummaryById.get(goal.id);
    return {
      goalId: goal.id,
      name: goal.name,
      progress: summary?.progress ?? 0,
      pendingAmount: summary?.pendingAmount ?? { amount: 0, currency: DEFAULT_CURRENCY },
      suggestedBiweeklyContribution: summary?.suggestedBiweeklyContribution ?? { amount: 0, currency: DEFAULT_CURRENCY },
    };
  });

  const debtSummaryById = new Map(debtSummariesRaw.map((summary) => [summary.debtId, summary]));
  const debtsSummary: DashboardDebtSummary[] = debts.map((debt) => {
    const summary = debtSummaryById.get(debt.id);
    return {
      debtId: debt.id,
      progress: summary?.progress ?? 0,
      paidAmount: summary?.paidAmount ?? { amount: 0, currency: DEFAULT_CURRENCY },
      remainingBalance: summary?.remainingBalance ?? debt.currentBalance,
    };
  });

  return {
    quincena,
    state: stateMeta.state,
    missing: stateMeta.missing,
    real: {
      liquidity: { amount: liquidity, currency: DEFAULT_CURRENCY },
      debtTotal: { amount: debtTotal, currency: DEFAULT_CURRENCY },
      netWorth: { amount: netWorth, currency: DEFAULT_CURRENCY },
      actualExpense: { amount: actualExpense, currency: DEFAULT_CURRENCY },
    },
    planned: {
      income: { amount: income, currency: DEFAULT_CURRENCY },
      plannedVariable: { amount: plannedVariable, currency: DEFAULT_CURRENCY },
      committedFixed: { amount: committedFixed, currency: DEFAULT_CURRENCY },
      reservedTotal: { amount: remaining.reservedTotal, currency: DEFAULT_CURRENCY },
    },
    remaining: {
      amount: { amount: remaining.amount, currency: DEFAULT_CURRENCY },
      reserveGap: { amount: remaining.reserveGap, currency: DEFAULT_CURRENCY },
      unplannedOverflow: { amount: remaining.unplannedOverflow, currency: DEFAULT_CURRENCY },
      status: stateMeta.state === 'complete' ? 'confirmed' : 'incomplete',
    },
    goals: goalsSummary,
    debts: debtsSummary,
  };
}
