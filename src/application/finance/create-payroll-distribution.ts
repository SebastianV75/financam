import type { FinanceRepository, PayrollDistributionTargetType } from '@/domain/finance';

interface CreatePayrollDistributionInput {
  distributionId: string;
  quincenaId: string;
  totalAmount: number;
  currency: 'MXN';
  entries: Array<{
    id: string;
    targetType: PayrollDistributionTargetType;
    targetId: string;
    allocatedAmount: number;
    sortOrder: number;
  }>;
}

export async function createPayrollDistribution(repository: FinanceRepository, input: CreatePayrollDistributionInput) {
  if (input.totalAmount <= 0) throw new Error('El total de nómina debe ser mayor a cero.');

  const allocatedTotal = input.entries.reduce((sum, entry) => sum + entry.allocatedAmount, 0);
  if (allocatedTotal > input.totalAmount) {
    throw new Error('La suma de distribución excede el total de nómina.');
  }

  for (const entry of input.entries) {
    if (entry.allocatedAmount <= 0) throw new Error('Cada asignación debe ser mayor a cero.');
    if (entry.targetType !== 'account' && entry.targetType !== 'category') {
      throw new Error('Tipo de destino de distribución inválido.');
    }
  }

  return repository.savePayrollDistributionDraft({
    id: input.distributionId,
    quincenaId: input.quincenaId,
    total: { amount: input.totalAmount, currency: input.currency },
    entries: input.entries.map((entry) => ({
      id: entry.id,
      distributionId: input.distributionId,
      targetType: entry.targetType,
      targetId: entry.targetId,
      allocated: { amount: entry.allocatedAmount, currency: input.currency },
      sortOrder: entry.sortOrder,
    })),
  });
}
