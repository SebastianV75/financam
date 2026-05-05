import type { FinanceRepository } from '@/domain/finance';

import { getDashboardSummary } from './get-dashboard-summary';

function createRepositoryStub(overrides: Partial<FinanceRepository> = {}): FinanceRepository {
  return {
    getQuincenaById: jest.fn(),
    ensureQuincenaForDate: jest.fn().mockResolvedValue({ id: 'q1', label: 'Q1', startsAt: '2026-05-01', endsAt: '2026-05-15' }),
    listQuincenasByMonth: jest.fn(),
    getOperationalSnapshotByQuincena: jest.fn(),
    listPlanByQuincena: jest.fn(),
    saveFinancialPlan: jest.fn(),
    listFinancialPlansByQuincena: jest.fn().mockResolvedValue([]),
    createFixedExpense: jest.fn(),
    updateFixedExpense: jest.fn(),
    deactivateFixedExpense: jest.fn(),
    listFixedExpenses: jest.fn(),
    refreshFixedExpenseProjections: jest.fn(),
    listFixedExpenseProjectionsByQuincena: jest.fn().mockResolvedValue([]),
    listAccounts: jest.fn(),
    createAccount: jest.fn(),
    listCategories: jest.fn(),
    createCategory: jest.fn(),
    createOperationalMovement: jest.fn(),
    listMovementsByQuincena: jest.fn().mockResolvedValue([]),
    getAccountBalances: jest.fn().mockResolvedValue([]),
    savePayrollDistributionDraft: jest.fn(),
    getPayrollDistributionByQuincena: jest.fn().mockResolvedValue(null),
    getPayrollDistributionById: jest.fn(),
    applyPayrollDistribution: jest.fn(),
    listAppliedMovementsByDistribution: jest.fn(),
    createSavingsGoal: jest.fn(),
    updateSavingsGoal: jest.fn(),
    getSavingsGoalById: jest.fn(),
    listSavingsGoals: jest.fn().mockResolvedValue([]),
    createDebt: jest.fn(),
    updateDebt: jest.fn(),
    getDebtById: jest.fn(),
    listDebts: jest.fn().mockResolvedValue([]),
    recordGoalContribution: jest.fn(),
    recordDebtPayment: jest.fn(),
    getSavingsGoalSummary: jest.fn(),
    getDebtSummary: jest.fn(),
    ...overrides,
  };
}

describe('getDashboardSummary', () => {
  it('separa real vs planeado y calcula remanente v1', async () => {
    const repository = createRepositoryStub({
      getAccountBalances: jest.fn().mockResolvedValue([
        { accountId: 'a1', balance: { amount: 7000, currency: 'MXN' } },
        { accountId: 'a2', balance: { amount: 3000, currency: 'MXN' } },
      ]),
      listDebts: jest.fn().mockResolvedValue([
        { id: 'd1', status: 'active', currentBalance: { amount: 1000, currency: 'MXN' }, principalAmount: { amount: 2000, currency: 'MXN' } },
      ]),
      getDebtSummary: jest.fn().mockResolvedValue({
        debtId: 'd1',
        progress: 0.5,
        paidAmount: { amount: 1000, currency: 'MXN' },
        remainingBalance: { amount: 1000, currency: 'MXN' },
      }),
      getPayrollDistributionByQuincena: jest.fn().mockResolvedValue({
        id: 'pd1',
        quincenaId: 'q1',
        total: { amount: 10000, currency: 'MXN' },
        status: 'applied',
        incomeMovementId: 'm-income',
        appliedAt: '2026-05-03',
        entries: [],
      }),
      listFinancialPlansByQuincena: jest.fn().mockResolvedValue([
        { id: 'fp1', quincenaId: 'q1', categoryId: 'c1', accountId: null, isFixed: false, fixedExpenseId: null, planned: { amount: 3000, currency: 'MXN' } },
        { id: 'fp2', quincenaId: 'q1', categoryId: 'c2', accountId: null, isFixed: true, fixedExpenseId: 'fx1', planned: { amount: 800, currency: 'MXN' } },
      ]),
      listFixedExpenseProjectionsByQuincena: jest.fn().mockResolvedValue([
        {
          id: 'fep1',
          fixedExpenseId: 'fx1',
          quincenaId: 'q1',
          categoryId: 'c2',
          accountId: null,
          amount: { amount: 2000, currency: 'MXN' },
          status: 'linked',
          financialPlanId: 'fp2',
        },
      ]),
      listMovementsByQuincena: jest.fn().mockResolvedValue([
        { id: 'm1', quincenaId: 'q1', occurredAt: '2026-05-05', kind: 'expense', amount: { amount: 4500, currency: 'MXN' }, fromAccountId: 'a1', toAccountId: null, categoryId: 'c1' },
      ]),
    });

    const summary = await getDashboardSummary(repository);

    expect(summary.real.liquidity.amount).toBe(10000);
    expect(summary.real.debtTotal.amount).toBe(1000);
    expect(summary.real.netWorth.amount).toBe(9000);
    expect(summary.planned.plannedVariable.amount).toBe(3000);
    expect(summary.planned.committedFixed.amount).toBe(2000);
    expect(summary.remaining.amount.amount).toBe(5000);
    expect(summary.state).toBe('complete');
  });

  it('maneja quincena sin distribución aplicada con estado incompleto', async () => {
    const repository = createRepositoryStub({
      getPayrollDistributionByQuincena: jest.fn().mockResolvedValue({
        id: 'pd1',
        quincenaId: 'q1',
        total: { amount: 10000, currency: 'MXN' },
        status: 'draft',
        incomeMovementId: null,
        appliedAt: null,
        entries: [],
      }),
      listDebts: jest.fn().mockResolvedValue([]),
      listFinancialPlansByQuincena: jest.fn().mockResolvedValue([]),
      listFixedExpenseProjectionsByQuincena: jest.fn().mockResolvedValue([]),
      listMovementsByQuincena: jest.fn().mockResolvedValue([]),
      getAccountBalances: jest.fn().mockResolvedValue([]),
    });

    const summary = await getDashboardSummary(repository);

    expect(summary.planned.income.amount).toBe(0);
    expect(summary.remaining.status).toBe('incomplete');
    expect(summary.missing).toContain('income');
    expect(summary.real.debtTotal.amount).toBe(0);
    expect(summary.state).toBe('empty');
  });

  it('marca remanente incompleto aunque haya ingreso si faltan planes o compromisos', async () => {
    const repository = createRepositoryStub({
      getPayrollDistributionByQuincena: jest.fn().mockResolvedValue({
        id: 'pd1',
        quincenaId: 'q1',
        total: { amount: 12000, currency: 'MXN' },
        status: 'applied',
        incomeMovementId: 'm-income',
        appliedAt: '2026-05-03',
        entries: [],
      }),
      listDebts: jest.fn().mockResolvedValue([]),
      listFinancialPlansByQuincena: jest.fn().mockResolvedValue([]),
      listFixedExpenseProjectionsByQuincena: jest.fn().mockResolvedValue([]),
      listMovementsByQuincena: jest.fn().mockResolvedValue([]),
      getAccountBalances: jest.fn().mockResolvedValue([]),
    });

    const summary = await getDashboardSummary(repository);

    expect(summary.planned.income.amount).toBe(12000);
    expect(summary.state).toBe('partial');
    expect(summary.missing).toEqual(expect.arrayContaining(['plans', 'fixed-expenses']));
    expect(summary.remaining.status).toBe('incomplete');
  });
});
