import { SQLiteFinanceRepository } from './sqlite-finance-repository';
import type { DatabaseClient } from '@/infrastructure/db/types';

describe('SQLiteFinanceRepository', () => {
  let mockDb: jest.Mocked<DatabaseClient>;
  let repository: SQLiteFinanceRepository;

  beforeEach(() => {
    mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      getAllAsync: jest.fn().mockResolvedValue([]),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      withTransaction: jest.fn().mockImplementation(async (operation) => operation()),
    };
    repository = new SQLiteFinanceRepository(mockDb);
  });

  it('crea y lista cuentas/categorías', async () => {
    await repository.createAccount({ id: 'a1', name: 'Efectivo', type: 'cash' });
    await repository.createCategory({ id: 'c1', name: 'Comida' });

    expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO accounts'));
    expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO categories'));
  });

  it('crea transferencias en transacción atómica', async () => {
    await repository.createOperationalMovement({
      id: 'm1',
      quincenaId: 'q1',
      occurredAt: '2026-01-01T10:00:00Z',
      kind: 'transfer',
      amount: { amount: 1000, currency: 'MXN' },
      fromAccountId: 'a1',
      toAccountId: 'a2',
      categoryId: null,
      note: 'paso interno',
    });

    expect(mockDb.withTransaction).toHaveBeenCalledTimes(1);
    expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO operational_movements'));
  });

  it('calcula saldos derivados por SQL', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ account_id: 'a1', balance: 5000 }]);

    const balances = await repository.getAccountBalances();

    expect(mockDb.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('CASE'));
    expect(balances).toEqual([{ accountId: 'a1', balance: { amount: 5000, currency: 'MXN' } }]);
  });

  it('mapea movimientos con columnas nuevas sin romper filas viejas', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'm-old',
        quincena_id: 'q1',
        occurred_at: '2026-01-01T00:00:00Z',
        kind: 'expense',
        amount: 200,
        currency: 'MXN',
        from_account_id: null,
        to_account_id: null,
        category_id: null,
        note: null,
      },
    ]);

    const result = await repository.listMovementsByQuincena('q1');
    expect(result[0].fromAccountId).toBeNull();
    expect(result[0].categoryId).toBeNull();
  });
});
