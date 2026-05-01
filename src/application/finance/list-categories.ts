import type { Category, FinanceRepository } from '@/domain/finance';

export function listCategories(repository: FinanceRepository): Promise<Category[]> {
  return repository.listCategories();
}
