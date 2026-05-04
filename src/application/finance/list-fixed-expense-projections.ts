import type { FinanceRepository, QuincenaId } from '@/domain/finance';

export async function listFixedExpenseProjections(
  repository: FinanceRepository,
  input: { quincenaId: QuincenaId },
) {
  await repository.refreshFixedExpenseProjections(input.quincenaId);
  return repository.listFixedExpenseProjectionsByQuincena(input.quincenaId);
}
