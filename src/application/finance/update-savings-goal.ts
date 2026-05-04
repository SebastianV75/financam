import type { FinanceRepository, SavingsGoalDraft } from '@/domain/finance';

export async function updateSavingsGoal(repository: FinanceRepository, input: SavingsGoalDraft) {
  return repository.updateSavingsGoal(input);
}
