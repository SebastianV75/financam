import type { FinanceRepository, OperationalMovementDraft, OperationalMovementRecord } from '@/domain/finance';

export async function createOperationalMovement(
  repository: FinanceRepository,
  input: OperationalMovementDraft,
): Promise<OperationalMovementRecord> {
  if (input.kind === 'income') {
    if (!input.toAccountId) throw new Error('Ingreso requiere cuenta destino.');
    if (!input.categoryId) throw new Error('Ingreso requiere categoría.');
  }

  if (input.kind === 'expense') {
    if (!input.fromAccountId) throw new Error('Gasto requiere cuenta origen.');
    if (!input.categoryId) throw new Error('Gasto requiere categoría.');
  }

  if (input.kind === 'transfer') {
    if (!input.fromAccountId || !input.toAccountId) {
      throw new Error('Transferencia requiere cuenta origen y destino.');
    }
    if (input.fromAccountId === input.toAccountId) {
      throw new Error('Transferencia inválida: origen y destino deben ser distintos.');
    }
  }

  return repository.createOperationalMovement(input);
}
