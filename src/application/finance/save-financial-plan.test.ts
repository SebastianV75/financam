import { saveFinancialPlan } from './save-financial-plan';

describe('saveFinancialPlan', () => {
  it('valida vínculo obligatorio cuando isFixed=true', async () => {
    const repository = { saveFinancialPlan: jest.fn() };

    await expect(
      saveFinancialPlan(repository as never, {
        id: 'fp-1',
        quincenaId: 'q1',
        categoryId: 'cat-1',
        accountId: null,
        isFixed: true,
        fixedExpenseId: null,
        planned: { amount: 1000, currency: 'MXN' },
      }),
    ).rejects.toThrow('requiere fixed_expense_id');
  });
});
