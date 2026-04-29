import { getFinanceFoundation } from './get-finance-foundation';

describe('getFinanceFoundation', () => {
  it('combina plan y movimientos por quincena', async () => {
    const repository = {
      listPlanByQuincena: jest.fn().mockResolvedValue([{ id: 'plan-1' }]),
      listMovementsByQuincena: jest.fn().mockResolvedValue([{ id: 'movement-1' }]),
    };

    const result = await getFinanceFoundation(repository as never, { quincenaId: 'q-1' });

    expect(repository.listPlanByQuincena).toHaveBeenCalledWith('q-1');
    expect(repository.listMovementsByQuincena).toHaveBeenCalledWith('q-1');
    expect(result).toEqual({
      quincenaId: 'q-1',
      plan: [{ id: 'plan-1' }],
      movements: [{ id: 'movement-1' }],
    });
  });
});
