import type { DebtDraft, FinanceRepository } from '@/domain/finance';

export async function updateDebt(repository: FinanceRepository, input: DebtDraft) {
  return repository.updateDebt(input);
}
