import { calculateDashboardRemainingV1, classifyEligibleExpenseMovements, deriveDashboardState } from './dashboard';

describe('dashboard rules', () => {
  it('calcula remanente y reserve gap cuando el gasto real no supera reserva', () => {
    const result = calculateDashboardRemainingV1({
      income: 10000,
      plannedVariable: 3000,
      committedFixed: 2000,
      actualExpense: 4200,
    });

    expect(result.reservedTotal).toBe(5000);
    expect(result.reserveGap).toBe(800);
    expect(result.unplannedOverflow).toBe(0);
    expect(result.amount).toBe(5000);
  });

  it('calcula overflow no planeado cuando el gasto real supera reserva', () => {
    const result = calculateDashboardRemainingV1({
      income: 10000,
      plannedVariable: 3000,
      committedFixed: 2000,
      actualExpense: 7000,
    });

    expect(result.reservedTotal).toBe(5000);
    expect(result.reserveGap).toBe(0);
    expect(result.unplannedOverflow).toBe(2000);
    expect(result.amount).toBe(3000);
  });

  it('marca estado empty y partial según faltantes', () => {
    expect(deriveDashboardState({ income: 0, plannedVariable: 0, committedFixed: 0 })).toEqual({
      state: 'empty',
      missing: ['income', 'plans', 'fixed-expenses'],
    });

    expect(deriveDashboardState({ income: 0, plannedVariable: 1200, committedFixed: 0 })).toEqual({
      state: 'partial',
      missing: ['income', 'fixed-expenses'],
    });
  });

  it('clasifica solo gastos elegibles excluyendo goal/debt', () => {
    const result = classifyEligibleExpenseMovements([
      {
        id: 'm1', quincenaId: 'q1', occurredAt: '2026-05-01', kind: 'expense',
        amount: { amount: 100, currency: 'MXN' }, fromAccountId: 'a1', toAccountId: null, categoryId: 'c1',
      },
      {
        id: 'm2', quincenaId: 'q1', occurredAt: '2026-05-01', kind: 'expense',
        amount: { amount: 100, currency: 'MXN' }, fromAccountId: 'a1', toAccountId: null, categoryId: 'c1', goalId: 'g1',
      },
      {
        id: 'm3', quincenaId: 'q1', occurredAt: '2026-05-01', kind: 'income',
        amount: { amount: 100, currency: 'MXN' }, fromAccountId: null, toAccountId: 'a1', categoryId: 'c1',
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('m1');
  });
});
