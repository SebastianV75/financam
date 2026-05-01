import { getFinanceFoundation } from './get-finance-foundation';

describe('getFinanceFoundation', () => {
  it('combina catálogos y movimientos operativos por quincena', async () => {
    const repository = {
      ensureQuincenaForDate: jest.fn().mockResolvedValue({
        id: 'q-1',
        startsAt: '2026-05-01',
        endsAt: '2026-05-15',
        label: 'Q1',
      }),
      listAccounts: jest.fn().mockResolvedValue([{ id: 'a-1' }]),
      listCategories: jest.fn().mockResolvedValue([{ id: 'c-1' }]),
      listMovementsByQuincena: jest.fn().mockResolvedValue([{ id: 'movement-1' }]),
      getAccountBalances: jest.fn().mockResolvedValue([{ accountId: 'a-1', balance: { amount: 100, currency: 'MXN' } }]),
    };

    const result = await getFinanceFoundation(repository as never, { date: new Date('2026-05-12') });

    expect(repository.listAccounts).toHaveBeenCalled();
    expect(repository.listCategories).toHaveBeenCalled();
    expect(repository.listMovementsByQuincena).toHaveBeenCalledWith('q-1');
    expect(repository.getAccountBalances).toHaveBeenCalled();
    expect(result).toEqual({
      quincena: { id: 'q-1', startsAt: '2026-05-01', endsAt: '2026-05-15', label: 'Q1' },
      accounts: [{ id: 'a-1' }],
      categories: [{ id: 'c-1' }],
      movements: [{ id: 'movement-1' }],
      balances: [{ accountId: 'a-1', balance: { amount: 100, currency: 'MXN' } }],
    });
  });
});
