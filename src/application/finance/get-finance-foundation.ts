import type { FinanceRepository, QuincenaId } from '@/domain/finance';

interface GetFinanceFoundationInput {
  quincenaId: QuincenaId;
}

export async function getFinanceFoundation(
  repository: FinanceRepository,
  input: GetFinanceFoundationInput,
) {
  const [plan, movements] = await Promise.all([
    repository.listPlanByQuincena(input.quincenaId),
    repository.listMovementsByQuincena(input.quincenaId),
  ]);

  return {
    quincenaId: input.quincenaId,
    plan,
    movements,
  };
}
