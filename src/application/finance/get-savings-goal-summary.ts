import type { FinanceRepository } from '@/domain/finance';

export async function getSavingsGoalSummary(
  repository: FinanceRepository,
  input: { goalId: string; asOfDate: string },
) {
  return repository.getSavingsGoalSummary(input.goalId, input.asOfDate);
}
