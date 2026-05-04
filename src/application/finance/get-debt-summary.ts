import type { FinanceRepository } from '@/domain/finance';

export async function getDebtSummary(repository: FinanceRepository, input: { debtId: string }) {
  return repository.getDebtSummary(input.debtId);
}
