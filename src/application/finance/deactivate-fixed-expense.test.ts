import { deactivateFixedExpense } from './deactivate-fixed-expense';

describe('deactivateFixedExpense', () => {
  it('desactiva gasto fijo', async () => {
    const repository = {
      deactivateFixedExpense: jest.fn().mockResolvedValue(undefined),
    };

    await deactivateFixedExpense(repository as never, { id: 'fe-1' });

    expect(repository.deactivateFixedExpense).toHaveBeenCalledWith('fe-1');
  });
});
