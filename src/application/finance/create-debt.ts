import type { DebtDraft, FinanceRepository } from '@/domain/finance';

export async function createDebt(repository: FinanceRepository, input: DebtDraft) {
  return repository.createDebt(input);
}
