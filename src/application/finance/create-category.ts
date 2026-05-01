import type { Category, CreateCategoryInput, FinanceRepository } from '@/domain/finance';

export async function createCategory(
  repository: FinanceRepository,
  input: CreateCategoryInput,
): Promise<Category> {
  if (!input.name.trim()) {
    throw new Error('El nombre de la categoría es obligatorio.');
  }

  return repository.createCategory({ ...input, name: input.name.trim() });
}
