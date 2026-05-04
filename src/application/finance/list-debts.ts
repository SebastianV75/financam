import type { FinanceRepository } from '@/domain/finance';

export async function listDebts(repository: FinanceRepository) {
  return repository.listDebts();
}
