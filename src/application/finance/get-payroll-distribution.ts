import type { FinanceRepository } from '@/domain/finance';

interface GetPayrollDistributionInput {
  distributionId?: string;
  quincenaId?: string;
}

export async function getPayrollDistribution(repository: FinanceRepository, input: GetPayrollDistributionInput) {
  if (!input.distributionId && !input.quincenaId) {
    throw new Error('Se requiere distributionId o quincenaId para consultar distribución.');
  }

  if (input.distributionId) {
    return repository.getPayrollDistributionById(input.distributionId);
  }

  return repository.getPayrollDistributionByQuincena(input.quincenaId as string);
}
