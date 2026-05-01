import type { FinanceRepository, QuincenaId } from '@/domain/finance';

interface GetFinanceFoundationInput {
  quincenaId: QuincenaId;
}

export async function getFinanceFoundation(
  repository: FinanceRepository,
  input: GetFinanceFoundationInput,
) {
  const [accounts, categories, movements, balances] = await Promise.all([
    repository.listAccounts(),
    repository.listCategories(),
    repository.listMovementsByQuincena(input.quincenaId),
    repository.getAccountBalances(),
  ]);

  return {
    quincenaId: input.quincenaId,
    accounts,
    categories,
    movements,
    balances,
  };
}
