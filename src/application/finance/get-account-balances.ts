import type { AccountBalance, FinanceRepository } from '@/domain/finance';

export function getAccountBalances(repository: FinanceRepository): Promise<AccountBalance[]> {
  return repository.getAccountBalances();
}
