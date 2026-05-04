import type { FinanceRepository } from '@/domain/finance';

export async function deactivateFixedExpense(repository: FinanceRepository, input: { id: string }) {
  await repository.deactivateFixedExpense(input.id);
}
