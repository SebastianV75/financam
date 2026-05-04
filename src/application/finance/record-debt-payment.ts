import type { FinanceRepository, OperationalMovementDraft } from '@/domain/finance';

export async function recordDebtPayment(repository: FinanceRepository, input: OperationalMovementDraft) {
  if (!input.debtId) throw new Error('Pago inválido: debtId es requerido.');
  if (input.kind !== 'expense') throw new Error('Pago de deuda inválido: debe registrarse como expense.');

  const debt = await repository.getDebtById(input.debtId);
  if (!debt) throw new Error('Deuda no encontrada para pago.');
  if (input.fromAccountId !== debt.accountId) {
    throw new Error('Pago de deuda inválido: fromAccountId debe coincidir con la cuenta de la deuda.');
  }

  return repository.recordDebtPayment(input);
}
