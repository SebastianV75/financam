import type { Account, FinanceRepository } from '@/domain/finance';

export function listAccounts(repository: FinanceRepository): Promise<Account[]> {
  return repository.listAccounts();
}
