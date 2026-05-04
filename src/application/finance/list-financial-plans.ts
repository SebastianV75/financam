import type { FinanceRepository, QuincenaId } from '@/domain/finance';

export async function listFinancialPlans(repository: FinanceRepository, input: { quincenaId: QuincenaId }) {
  return repository.listFinancialPlansByQuincena(input.quincenaId);
}
