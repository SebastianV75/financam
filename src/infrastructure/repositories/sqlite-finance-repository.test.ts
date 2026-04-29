import { SQLiteFinanceRepository } from './sqlite-finance-repository';
import type { DatabaseClient } from '@/infrastructure/db/types';

describe('SQLiteFinanceRepository (Integration)', () => {
  let mockDb: jest.Mocked<DatabaseClient>;
  let repository: SQLiteFinanceRepository;

  beforeEach(() => {
    mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      getAllAsync: jest.fn().mockResolvedValue([]),
    };
    repository = new SQLiteFinanceRepository(mockDb);
  });

  describe('listPlanByQuincena', () => {
    it('retorna lista vacía cuando no hay planes para la quincena', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const result = await repository.listPlanByQuincena('q-2024-001');

      expect(result).toEqual([]);
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, quincena_id, category_id, planned_amount, currency'),
        ['q-2024-001'],
      );
    });

    it('mapea correctamente los registros del plan financiero', async () => {
      const dbRows = [
        {
          id: 'plan-1',
          quincena_id: 'q-2024-001',
          category_id: 'cat-groceries',
          planned_amount: 250000,
          currency: 'MXN',
        },
        {
          id: 'plan-2',
          quincena_id: 'q-2024-001',
          category_id: 'cat-transport',
          planned_amount: 150000,
          currency: null,
        },
      ];
      mockDb.getAllAsync.mockResolvedValue(dbRows);

      const result = await repository.listPlanByQuincena('q-2024-001');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'plan-1',
        quincenaId: 'q-2024-001',
        categoryId: 'cat-groceries',
        planned: { amount: 250000, currency: 'MXN' },
      });
      expect(result[1]).toEqual({
        id: 'plan-2',
        quincenaId: 'q-2024-001',
        categoryId: 'cat-transport',
        planned: { amount: 150000, currency: 'MXN' },
      });
    });

    it('filtra por quincena_id correctamente', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      await repository.listPlanByQuincena('q-2024-002');

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE quincena_id = ?'),
        ['q-2024-002'],
      );
    });
  });

  describe('listMovementsByQuincena', () => {
    it('retorna lista vacía cuando no hay movimientos para la quincena', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const result = await repository.listMovementsByQuincena('q-2024-001');

      expect(result).toEqual([]);
    });

    it('mapea correctamente los movimientos operativos', async () => {
      const dbRows = [
        {
          id: 'mov-1',
          quincena_id: 'q-2024-001',
          occurred_at: '2024-01-15T10:30:00Z',
          kind: 'expense',
          amount: 125000,
          currency: 'MXN',
        },
        {
          id: 'mov-2',
          quincena_id: 'q-2024-001',
          occurred_at: '2024-01-16T08:00:00Z',
          kind: 'income',
          amount: 500000,
          currency: null,
        },
      ];
      mockDb.getAllAsync.mockResolvedValue(dbRows);

      const result = await repository.listMovementsByQuincena('q-2024-001');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'mov-1',
        quincenaId: 'q-2024-001',
        occurredAt: '2024-01-15T10:30:00Z',
        kind: 'expense',
        amount: { amount: 125000, currency: 'MXN' },
      });
      expect(result[1]).toEqual({
        id: 'mov-2',
        quincenaId: 'q-2024-001',
        occurredAt: '2024-01-16T08:00:00Z',
        kind: 'income',
        amount: { amount: 500000, currency: 'MXN' },
      });
    });

    it('ordena movimientos por occurred_at DESC', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      await repository.listMovementsByQuincena('q-2024-001');

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY occurred_at DESC'),
        expect.anything(),
      );
    });

    it('soporta los tres tipos de movimiento: expense, income, transfer', async () => {
      const dbRows = [
        { id: '1', quincena_id: 'q-1', occurred_at: '2024-01-01', kind: 'expense', amount: 100, currency: 'MXN' },
        { id: '2', quincena_id: 'q-1', occurred_at: '2024-01-02', kind: 'income', amount: 1000, currency: 'MXN' },
        { id: '3', quincena_id: 'q-1', occurred_at: '2024-01-03', kind: 'transfer', amount: 200, currency: 'MXN' },
      ];
      mockDb.getAllAsync.mockResolvedValue(dbRows);

      const result = await repository.listMovementsByQuincena('q-1');

      expect(result.map((r) => r.kind)).toEqual(['expense', 'income', 'transfer']);
    });
  });

  describe('Separación de conceptos del dominio', () => {
    it('mantiene separación entre plan financiero y movimientos operativos', async () => {
      // Cada método consulta tabla diferente
      mockDb.getAllAsync.mockResolvedValue([]);

      await repository.listPlanByQuincena('q-1');
      expect(mockDb.getAllAsync).toHaveBeenLastCalledWith(
        expect.stringContaining('FROM financial_plans'),
        ['q-1'],
      );

      await repository.listMovementsByQuincena('q-1');
      expect(mockDb.getAllAsync).toHaveBeenLastCalledWith(
        expect.stringContaining('FROM operational_movements'),
        ['q-1'],
      );
    });
  });
});
