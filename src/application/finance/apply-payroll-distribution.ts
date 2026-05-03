import type { FinanceRepository } from '@/domain/finance';
import { normalizeToLocalDate } from '@/domain/finance/rules/pay-cycle';

interface ApplyPayrollDistributionInput {
  applicationId: string;
  distributionId: string;
  incomeMovementId: string;
  appliedAt: string;
}

export async function applyPayrollDistribution(repository: FinanceRepository, input: ApplyPayrollDistributionInput) {
  const distribution = await repository.getPayrollDistributionById(input.distributionId);
  if (!distribution) {
    throw new Error('Distribución de nómina no encontrada.');
  }

  if (distribution.entries.length === 0) {
    throw new Error('No se puede aplicar una distribución sin destinos.');
  }

  if (distribution.status === 'applied') {
    return repository.applyPayrollDistribution({
      applicationId: input.applicationId,
      distributionId: input.distributionId,
      incomeMovementId: input.incomeMovementId,
      appliedAt: normalizeToLocalDate(input.appliedAt),
    });
  }

  return repository.applyPayrollDistribution({
    applicationId: input.applicationId,
    distributionId: input.distributionId,
    incomeMovementId: input.incomeMovementId,
    appliedAt: normalizeToLocalDate(input.appliedAt),
  });
}
