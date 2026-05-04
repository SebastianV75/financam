import type { FinanceRepository, SavingsGoalDraft } from '@/domain/finance';

export async function createSavingsGoal(repository: FinanceRepository, input: SavingsGoalDraft) {
  return repository.createSavingsGoal(input);
}
