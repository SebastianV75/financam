import type { FinanceRepository } from '@/domain/finance';

export async function listPayCycles(repository: FinanceRepository, month: `${number}-${number}`) {
  return repository.listQuincenasByMonth(month);
}
