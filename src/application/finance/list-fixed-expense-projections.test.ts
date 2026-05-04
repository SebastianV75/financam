import { listFixedExpenseProjections } from './list-fixed-expense-projections';

describe('listFixedExpenseProjections', () => {
  it('refresca proyecciones antes de listar', async () => {
    const repository = {
      refreshFixedExpenseProjections: jest.fn().mockResolvedValue(undefined),
      listFixedExpenseProjectionsByQuincena: jest.fn().mockResolvedValue([]),
    };

    await listFixedExpenseProjections(repository as never, { quincenaId: 'q1' as never });

    expect(repository.refreshFixedExpenseProjections).toHaveBeenCalledWith('q1');
    expect(repository.listFixedExpenseProjectionsByQuincena).toHaveBeenCalledWith('q1');
  });
});
