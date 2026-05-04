import type { CreateFixedExpenseInput, FinanceRepository } from '@/domain/finance';

export async function createFixedExpense(repository: FinanceRepository, input: CreateFixedExpenseInput) {
  return repository.createFixedExpense(input);
}
