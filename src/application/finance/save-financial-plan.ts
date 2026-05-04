import type { FinanceRepository, SaveFinancialPlanInput } from '@/domain/finance';

export async function saveFinancialPlan(repository: FinanceRepository, input: SaveFinancialPlanInput) {
  if (input.isFixed && !input.fixedExpenseId) {
    throw new Error('Plan inválido: is_fixed requiere fixed_expense_id.');
  }

  return repository.saveFinancialPlan(input);
}
