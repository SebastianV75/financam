import type { FinanceRepository, OperationalMovementDraft } from '@/domain/finance';

export async function recordGoalContribution(repository: FinanceRepository, input: OperationalMovementDraft) {
  if (!input.goalId) throw new Error('Aporte inválido: goalId es requerido.');
  return repository.recordGoalContribution(input);
}
