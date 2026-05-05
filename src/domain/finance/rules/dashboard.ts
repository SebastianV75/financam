import type { DashboardMissingInput, DashboardSummaryState, OperationalMovementRecord } from '@/domain/finance';

interface RemainingInput {
  income: number;
  plannedVariable: number;
  committedFixed: number;
  actualExpense: number;
}

export function classifyEligibleExpenseMovements(movements: OperationalMovementRecord[]) {
  return movements.filter((movement) => movement.kind === 'expense' && !movement.goalId && !movement.debtId);
}

export function calculateDashboardRemainingV1(input: RemainingInput) {
  const reservedTotal = input.plannedVariable + input.committedFixed;
  const unplannedOverflow = Math.max(input.actualExpense - reservedTotal, 0);
  const reserveGap = Math.max(reservedTotal - input.actualExpense, 0);
  const amount = input.income - reserveGap - input.actualExpense;

  return {
    amount,
    reserveGap,
    unplannedOverflow,
    reservedTotal,
  };
}

export function deriveDashboardState(input: {
  income: number;
  plannedVariable: number;
  committedFixed: number;
}): { state: DashboardSummaryState; missing: DashboardMissingInput[] } {
  const missing: DashboardMissingInput[] = [];

  if (input.income <= 0) missing.push('income');
  if (input.plannedVariable <= 0) missing.push('plans');
  if (input.committedFixed <= 0) missing.push('fixed-expenses');

  if (missing.length === 3) {
    return { state: 'empty', missing };
  }

  if (missing.length > 0) {
    return { state: 'partial', missing };
  }

  return { state: 'complete', missing };
}
