import type { FinanceRepository } from '@/domain/finance';

export async function listSavingsGoals(repository: FinanceRepository) {
  return repository.listSavingsGoals();
}
