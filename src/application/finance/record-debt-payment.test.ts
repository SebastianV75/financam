import { recordDebtPayment } from './record-debt-payment';
import type { FinanceRepository } from '@/domain/finance';

describe('recordDebtPayment', () => {
  it('rechaza pagos que no son expense', async () => {
    const repository = {
      getDebtById: jest.fn(),
      recordDebtPayment: jest.fn(),
    } as unknown as FinanceRepository;

    await expect(
      recordDebtPayment(repository, {
        id: 'm1',
        quincenaId: 'q1',
        occurredAt: '2026-05-01',
        kind: 'income',
        amount: { amount: 100, currency: 'MXN' },
        fromAccountId: 'a1',
        toAccountId: null,
        categoryId: 'c1',
        debtId: 'd1',
      }),
    ).rejects.toThrow('debe registrarse como expense');
  });
});
