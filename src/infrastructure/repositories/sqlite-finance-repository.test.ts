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

  it('guarda borrador de payroll distribution con entries válidos', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ allocated_total: 800 })
      .mockResolvedValueOnce({
        id: 'pd-1',
        quincena_id: 'q1',
        total_amount: 1000,
        currency: 'MXN',
        status: 'draft',
        income_movement_id: null,
        applied_at: null,
      });
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'pde-1',
        distribution_id: 'pd-1',
        target_type: 'account',
        target_id: 'a2',
        allocated_amount: 800,
        currency: 'MXN',
        sort_order: 1,
      },
    ]);

    const result = await repository.savePayrollDistributionDraft({
      id: 'pd-1',
      quincenaId: 'q1',
      total: { amount: 1000, currency: 'MXN' },
      entries: [
        {
          id: 'pde-1',
          distributionId: 'pd-1',
          targetType: 'account',
          targetId: 'a2',
          allocated: { amount: 800, currency: 'MXN' },
          sortOrder: 1,
        },
      ],
    });

    expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO payroll_distributions'));
    expect(mockDb.execAsync).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO operational_movements'));
    expect(result.entries).toHaveLength(1);
  });

  it('sin apply no crea operational_movements para la distribución', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ allocated_total: 1000 })
      .mockResolvedValueOnce({
        id: 'pd-1',
        quincena_id: 'q1',
        total_amount: 1000,
        currency: 'MXN',
        status: 'draft',
        income_movement_id: null,
        applied_at: null,
      });

    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'pde-1',
        distribution_id: 'pd-1',
        target_type: 'account',
        target_id: 'a2',
        allocated_amount: 1000,
        currency: 'MXN',
        sort_order: 1,
      },
    ]);

    await repository.savePayrollDistributionDraft({
      id: 'pd-1',
      quincenaId: 'q1',
      total: { amount: 1000, currency: 'MXN' },
      entries: [
        {
          id: 'pde-1',
          distributionId: 'pd-1',
          targetType: 'account',
          targetId: 'a2',
          allocated: { amount: 1000, currency: 'MXN' },
          sortOrder: 1,
        },
      ],
    });

    const sqlCalls = mockDb.execAsync.mock.calls.map((call) => String(call[0]));
    expect(sqlCalls.some((sql) => sql.includes('INSERT INTO operational_movements'))).toBe(false);
  });

  it('rechaza borrador cuando SUM(entries) excede total', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ allocated_total: 1200 });

    await expect(
      repository.savePayrollDistributionDraft({
        id: 'pd-1',
        quincenaId: 'q1',
        total: { amount: 1000, currency: 'MXN' },
        entries: [
          {
            id: 'pde-1',
            distributionId: 'pd-1',
            targetType: 'account',
            targetId: 'a2',
            allocated: { amount: 1200, currency: 'MXN' },
            sortOrder: 1,
          },
        ],
      }),
    ).rejects.toThrow('excede');
  });

  it('bloquea edición de distribución aplicada', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 'pd-1',
      quincena_id: 'q1',
      total_amount: 1000,
      currency: 'MXN',
      status: 'applied',
      income_movement_id: 'income-1',
      applied_at: '2026-05-05',
    });

    await expect(
      repository.savePayrollDistributionDraft({
        id: 'pd-1',
        quincenaId: 'q1',
        total: { amount: 1000, currency: 'MXN' },
        entries: [],
      }),
    ).rejects.toThrow('ya aplicada');
  });

  it('aplica distribución y genera transfer/expense con trazabilidad', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({
        id: 'pd-1',
        quincena_id: 'q1',
        total_amount: 1000,
        currency: 'MXN',
        status: 'draft',
        income_movement_id: null,
        applied_at: null,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'income-1',
        quincena_id: 'q1',
        occurred_at: '2026-05-10',
        kind: 'income',
        amount: 1000,
        currency: 'MXN',
        from_account_id: null,
        to_account_id: 'a1',
        category_id: 'cat-income',
        note: null,
      })
      .mockResolvedValueOnce({
        id: 'q1',
        starts_at: '2026-05-01',
        ends_at: '2026-05-15',
        label: 'Q1',
      })
      .mockResolvedValueOnce({
        id: 'pd-1',
        quincena_id: 'q1',
        total_amount: 1000,
        currency: 'MXN',
        status: 'applied',
        income_movement_id: 'income-1',
        applied_at: '2026-05-10',
      });

    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'e-1',
        distribution_id: 'pd-1',
        target_type: 'account',
        target_id: 'a2',
        allocated_amount: 700,
        currency: 'MXN',
        sort_order: 1,
      },
      {
        id: 'e-2',
        distribution_id: 'pd-1',
        target_type: 'category',
        target_id: 'c1',
        allocated_amount: 300,
        currency: 'MXN',
        sort_order: 2,
      },
    ]);

    const result = await repository.applyPayrollDistribution({
      applicationId: 'app-1',
      distributionId: 'pd-1',
      incomeMovementId: 'income-1',
      appliedAt: '2026-05-10',
    });

    expect(result.alreadyApplied).toBe(false);
    expect(result.createdMovementIds).toHaveLength(2);
    expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO payroll_distribution_applications'));
    expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining("'transfer'"));
    expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining("'expense'"));
  });

  it('aplicar por segunda vez no duplica movimientos (idempotencia fuerte)', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({
        id: 'pd-1',
        quincena_id: 'q1',
        total_amount: 1000,
        currency: 'MXN',
        status: 'applied',
        income_movement_id: 'income-1',
        applied_at: '2026-05-10',
      })
      .mockResolvedValueOnce({
        id: 'app-1',
        distribution_id: 'pd-1',
        income_movement_id: 'income-1',
        applied_at: '2026-05-10',
      })
      .mockResolvedValueOnce({
        id: 'pd-1',
        quincena_id: 'q1',
        total_amount: 1000,
        currency: 'MXN',
        status: 'applied',
        income_movement_id: 'income-1',
        applied_at: '2026-05-10',
      });

    mockDb.getAllAsync.mockResolvedValue([]);

    const result = await repository.applyPayrollDistribution({
      applicationId: 'app-2',
      distributionId: 'pd-1',
      incomeMovementId: 'income-1',
      appliedAt: '2026-05-10',
    });

    expect(result.alreadyApplied).toBe(true);
    expect(result.createdMovementIds).toEqual([]);
  });

  it('rechaza apply si el ingreso pertenece a otra quincena', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({
        id: 'pd-1',
        quincena_id: 'q1',
        total_amount: 1000,
        currency: 'MXN',
        status: 'draft',
        income_movement_id: null,
        applied_at: null,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'income-1',
        quincena_id: 'q2',
        occurred_at: '2026-05-10',
        kind: 'income',
        amount: 1000,
        currency: 'MXN',
        from_account_id: null,
        to_account_id: 'a1',
        category_id: null,
        note: null,
      });
    mockDb.getAllAsync.mockResolvedValue([{ id: 'e-1', distribution_id: 'pd-1', target_type: 'account', target_id: 'a2', allocated_amount: 1000, currency: 'MXN', sort_order: 1 }]);

    await expect(
      repository.applyPayrollDistribution({
        applicationId: 'app-1',
        distributionId: 'pd-1',
        incomeMovementId: 'income-1',
        appliedAt: '2026-05-10',
      }),
    ).rejects.toThrow('quincena distinta');
  });

  it('rechaza apply si appliedAt está fuera del rango de la quincena', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({
        id: 'pd-1',
        quincena_id: 'q1',
        total_amount: 1000,
        currency: 'MXN',
        status: 'draft',
        income_movement_id: null,
        applied_at: null,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'income-1',
        quincena_id: 'q1',
        occurred_at: '2026-05-10',
        kind: 'income',
        amount: 1000,
        currency: 'MXN',
        from_account_id: null,
        to_account_id: 'a1',
        category_id: null,
        note: null,
      })
      .mockResolvedValueOnce({
        id: 'q1',
        starts_at: '2026-05-01',
        ends_at: '2026-05-15',
        label: 'Q1',
      });
    mockDb.getAllAsync.mockResolvedValue([{ id: 'e-1', distribution_id: 'pd-1', target_type: 'account', target_id: 'a2', allocated_amount: 1000, currency: 'MXN', sort_order: 1 }]);

    await expect(
      repository.applyPayrollDistribution({
        applicationId: 'app-1',
        distributionId: 'pd-1',
        incomeMovementId: 'income-1',
        appliedAt: '2026-05-20',
      }),
    ).rejects.toThrow('Fecha de aplicación fuera del rango');
  });

  it('lista solo movimientos creados por la distribución aplicada', async () => {
    mockDb.getFirstAsync.mockResolvedValue({
      id: 'pd-1',
      quincena_id: 'q1',
      total_amount: 1000,
      currency: 'MXN',
      status: 'applied',
      income_movement_id: 'income-1',
      applied_at: '2026-05-10',
    });
    mockDb.getAllAsync
      .mockResolvedValueOnce([
        {
          id: 'e-1',
          distribution_id: 'pd-1',
          target_type: 'account',
          target_id: 'a2',
          allocated_amount: 700,
          currency: 'MXN',
          sort_order: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'pd-1-e-1',
          quincena_id: 'q1',
          occurred_at: '2026-05-10',
          kind: 'transfer',
          amount: 700,
          currency: 'MXN',
          from_account_id: 'a1',
          to_account_id: 'a2',
          category_id: null,
          note: 'payroll distribution apply',
        },
        {
          id: 'other-movement',
          quincena_id: 'q1',
          occurred_at: '2026-05-11',
          kind: 'expense',
          amount: 100,
          currency: 'MXN',
          from_account_id: 'a1',
          to_account_id: null,
          category_id: 'c1',
          note: 'manual',
        },
      ]);

    const movements = await repository.listAppliedMovementsByDistribution('pd-1');

    expect(movements).toHaveLength(1);
    expect(movements[0].id).toBe('pd-1-e-1');
  });

  it('hace upsert de financial_plan por quincena+categoría', async () => {
    mockDb.getFirstAsync.mockResolvedValue({
      id: 'fp-1',
      quincena_id: 'q1',
      category_id: 'cat-1',
      account_id: null,
      is_fixed: 0,
      fixed_expense_id: null,
      planned_amount: 800,
      currency: 'MXN',
    });

    const saved = await repository.saveFinancialPlan({
      id: 'fp-1',
      quincenaId: 'q1',
      categoryId: 'cat-1',
      accountId: null,
      isFixed: false,
      fixedExpenseId: null,
      planned: { amount: 800, currency: 'MXN' },
    });

    expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT(quincena_id, category_id)'));
    expect(saved.categoryId).toBe('cat-1');
  });

  it('retorna colección vacía para quincena sin planeación', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    const plans = await repository.listFinancialPlansByQuincena('q-empty' as never);

    expect(plans).toEqual([]);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('FROM financial_plans'), ['q-empty']);
  });

  it('rechaza plan fijo sin fixed_expense_id', async () => {
    await expect(
      repository.saveFinancialPlan({
        id: 'fp-1',
        quincenaId: 'q1',
        categoryId: 'cat-1',
        accountId: null,
        isFixed: true,
        fixedExpenseId: null,
        planned: { amount: 800, currency: 'MXN' },
      }),
    ).rejects.toThrow('requiere fixed_expense_id');
  });

  it('refresh de proyecciones mensual aplica en primera quincena', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({ id: 'q1', starts_at: '2026-05-01', ends_at: '2026-05-15', label: 'Q1' })
      .mockResolvedValueOnce(null);
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'fe-1',
        name: 'Renta',
        amount: 5000,
        currency: 'MXN',
        category_id: 'cat-1',
        account_id: null,
        frequency: 'mensual',
        is_active: 1,
      },
    ]);

    await repository.refreshFixedExpenseProjections('q1' as never);
    expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO fixed_expense_projections'));
  });

  it('crea gasto fijo activo en SQLite', async () => {
    mockDb.getFirstAsync.mockResolvedValue({
      id: 'fe-1',
      name: 'Renta',
      amount: 5000,
      currency: 'MXN',
      category_id: 'cat-1',
      account_id: 'acc-1',
      frequency: 'mensual',
      is_active: 1,
    });

    const created = await repository.createFixedExpense({
      id: 'fe-1',
      name: 'Renta',
      amount: { amount: 5000, currency: 'MXN' },
      categoryId: 'cat-1',
      accountId: 'acc-1',
      frequency: 'mensual',
    });

    expect(created.isActive).toBe(true);
    expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO fixed_expenses'));
  });

  it('desactiva gasto fijo sin borrar historial', async () => {
    await repository.deactivateFixedExpense('fe-1');

    expect(mockDb.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE fixed_expenses SET is_active = 0"),
    );
    expect(mockDb.execAsync).not.toHaveBeenCalledWith(expect.stringContaining('DELETE FROM fixed_expenses'));
  });

  it('proyección expone categoryId y accountId según contrato', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'fep-1',
        fixed_expense_id: 'fe-1',
        quincena_id: 'q1',
        category_id: 'cat-1',
        account_id: 'acc-1',
        amount: 2500,
        currency: 'MXN',
        status: 'pending',
        financial_plan_id: null,
      },
    ]);

    const projections = await repository.listFixedExpenseProjectionsByQuincena('q1' as never);

    expect(projections[0]).toMatchObject({
      categoryId: 'cat-1',
      accountId: 'acc-1',
    });
  });

  it('refresh repetido preserva financial_plan_id enlazado (idempotencia)', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({ id: 'q1', starts_at: '2026-05-01', ends_at: '2026-05-15', label: 'Q1' })
      .mockResolvedValueOnce({ id: 'fp-1' })
      .mockResolvedValueOnce({ id: 'q1', starts_at: '2026-05-01', ends_at: '2026-05-15', label: 'Q1' })
      .mockResolvedValueOnce({ id: 'fp-1' });
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'fe-1',
        name: 'Renta',
        amount: 5000,
        currency: 'MXN',
        category_id: 'cat-1',
        account_id: null,
        frequency: 'quincenal',
        is_active: 1,
      },
    ]);

    await repository.refreshFixedExpenseProjections('q1' as never);
    await repository.refreshFixedExpenseProjections('q1' as never);

    const sqlCalls = mockDb.execAsync.mock.calls.map((call) => String(call[0]));
    const projectionUpserts = sqlCalls.filter((sql) => sql.includes('INSERT INTO fixed_expense_projections'));
    expect(projectionUpserts).toHaveLength(2);
    expect(projectionUpserts.every((sql) => sql.includes("'fp-1'"))).toBe(true);
    expect(projectionUpserts.every((sql) => sql.includes('COALESCE(fixed_expense_projections.financial_plan_id'))).toBe(true);
  });

  it('refresh de proyecciones mensual NO aplica en segunda quincena', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ id: 'q2', starts_at: '2026-05-16', ends_at: '2026-05-31', label: 'Q2' });
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'fe-1',
        name: 'Renta',
        amount: 5000,
        currency: 'MXN',
        category_id: 'cat-1',
        account_id: null,
        frequency: 'mensual',
        is_active: 1,
      },
    ]);

    await repository.refreshFixedExpenseProjections('q2' as never);
    const sqlCalls = mockDb.execAsync.mock.calls.map((c) => String(c[0]));
    expect(sqlCalls.some((sql) => sql.includes('INSERT INTO fixed_expense_projections'))).toBe(false);
  });
});
