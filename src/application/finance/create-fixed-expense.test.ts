import { createFixedExpense } from './create-fixed-expense';

describe('createFixedExpense', () => {
  it('crea gasto fijo activo', async () => {
    const repository = {
      createFixedExpense: jest.fn().mockResolvedValue({
        id: 'fe-1',
        name: 'Renta',
        amount: { amount: 5000, currency: 'MXN' },
        categoryId: 'cat-1',
        accountId: null,
        frequency: 'mensual',
        isActive: true,
      }),
    };

    const result = await createFixedExpense(repository as never, {
      id: 'fe-1',
      name: 'Renta',
      amount: { amount: 5000, currency: 'MXN' },
      categoryId: 'cat-1',
      accountId: null,
      frequency: 'mensual',
    });

    expect(repository.createFixedExpense).toHaveBeenCalled();
    expect(result.isActive).toBe(true);
  });
});
