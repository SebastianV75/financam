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
    mockDb.getFirstAsync.mockResolvedValue({
      id: 'q1',
      starts_at: '2026-01-01',
      ends_at: '2026-01-15',
      label: '2026-01-01 al 2026-01-15',
    });

    await repository.createOperationalMovement({
      id: 'm1',
      quincenaId: 'q1',
      occurredAt: '2026-01-01',
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

  it('rechaza movimiento fuera de rango de quincena', async () => {
    mockDb.getFirstAsync.mockResolvedValue({
      id: 'q1',
      starts_at: '2026-01-01',
      ends_at: '2026-01-15',
      label: 'Q1',
    });

    await expect(
      repository.createOperationalMovement({
        id: 'm1',
        quincenaId: 'q1',
        occurredAt: '2026-01-20',
        kind: 'expense',
        amount: { amount: 1000, currency: 'MXN' },
        fromAccountId: 'a1',
        toAccountId: null,
        categoryId: 'c1',
      }),
    ).rejects.toThrow('fuera del rango');
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

  it('asegura quincena idempotente y evita duplicado', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: '2026-05-01_2026-05-15',
        starts_at: '2026-05-01',
        ends_at: '2026-05-15',
        label: '2026-05-01 al 2026-05-15',
      });

    const quincena = await repository.ensureQuincenaForDate('2026-05-08');
    expect(quincena.id).toBe('2026-05-01_2026-05-15');
  });

  it('rechaza solapamiento inválido al asegurar quincena', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'q-existing' });

    await expect(repository.ensureQuincenaForDate('2026-05-08')).rejects.toThrow('rango solapado');
  });

  it('asegura quincena y queda listable por mes', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: '2026-05-01_2026-05-15',
        starts_at: '2026-05-01',
        ends_at: '2026-05-15',
        label: '2026-05-01 al 2026-05-15',
      },
    ]);

    const created = await repository.ensureQuincenaForDate('2026-05-08');
    const listed = await repository.listQuincenasByMonth('2026-05');

    expect(created.id).toBe('2026-05-01_2026-05-15');
    expect(listed.map((q) => q.id)).toContain(created.id);
  });

  it('construye snapshot operativo offline por quincena', async () => {
    mockDb.getFirstAsync.mockResolvedValue({
      id: 'q1',
      starts_at: '2026-05-01',
      ends_at: '2026-05-15',
      label: 'Q1',
    });
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'm1',
        quincena_id: 'q1',
        occurred_at: '2026-05-10',
        kind: 'expense',
        amount: 50,
        currency: 'MXN',
        from_account_id: 'a1',
        to_account_id: null,
        category_id: 'c1',
        note: null,
      },
    ]);

    const snapshot = await repository.getOperationalSnapshotByQuincena('q1' as never);
    expect(snapshot.quincena.id).toBe('q1');
    expect(snapshot.movements).toHaveLength(1);
  });

  it('mantiene semántica separada entre plan y movimientos reales en el mismo periodo', async () => {
    mockDb.getFirstAsync.mockResolvedValue({
      id: 'q1',
      starts_at: '2026-05-01',
      ends_at: '2026-05-15',
      label: 'Q1',
    });
    mockDb.getAllAsync.mockImplementation(async (query) => {
      if (query.includes('FROM operational_movements')) {
        return [
          {
            id: 'm1',
            quincena_id: 'q1',
            occurred_at: '2026-05-10',
            kind: 'expense',
            amount: 50,
            currency: 'MXN',
            from_account_id: 'a1',
            to_account_id: null,
            category_id: 'c1',
            note: null,
          },
        ];
      }
      return [];
    });

    const snapshot = await repository.getOperationalSnapshotByQuincena('q1' as never);

    expect(snapshot.quincena.id).toBe('q1');
    expect(snapshot.movements).toHaveLength(1);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('FROM operational_movements'), ['q1']);
    expect(mockDb.getAllAsync).not.toHaveBeenCalledWith(expect.stringContaining('FROM financial_plans'), ['q1']);
  });
});
