import type { FinanceRepository, UpdateFixedExpenseInput } from '@/domain/finance';

export async function updateFixedExpense(repository: FinanceRepository, input: UpdateFixedExpenseInput) {
  return repository.updateFixedExpense(input);
}
