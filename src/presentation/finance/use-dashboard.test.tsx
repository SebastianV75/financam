import { act, create } from 'react-test-renderer';

import { useDashboard } from './use-dashboard';

jest.mock('@/infrastructure/db/provider', () => ({
  useDatabaseContext: jest.fn(),
}));

jest.mock('@/infrastructure/db/client', () => ({
  toDatabaseClient: jest.fn(() => ({ mocked: true })),
}));

jest.mock('@/infrastructure/repositories/sqlite-finance-repository', () => ({
  SQLiteFinanceRepository: jest.fn().mockImplementation(() => ({ mockedRepository: true })),
}));

jest.mock('@/application/finance', () => ({
  getDashboardSummary: jest.fn(),
}));

const { useDatabaseContext } = jest.requireMock('@/infrastructure/db/provider') as {
  useDatabaseContext: jest.Mock;
};
const { getDashboardSummary } = jest.requireMock('@/application/finance') as {
  getDashboardSummary: jest.Mock;
};

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('useDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('carga summary al montar y expone datos', async () => {
    useDatabaseContext.mockReturnValue({ db: {} });
    getDashboardSummary.mockResolvedValue({
      quincena: { id: 'q1', label: 'Q1', startsAt: '2026-05-01', endsAt: '2026-05-15' },
      state: 'complete',
      missing: [],
      real: {
        liquidity: { amount: 1000, currency: 'MXN' },
        debtTotal: { amount: 0, currency: 'MXN' },
        netWorth: { amount: 1000, currency: 'MXN' },
        actualExpense: { amount: 200, currency: 'MXN' },
      },
      planned: {
        income: { amount: 3000, currency: 'MXN' },
        plannedVariable: { amount: 1000, currency: 'MXN' },
        committedFixed: { amount: 500, currency: 'MXN' },
        reservedTotal: { amount: 1500, currency: 'MXN' },
      },
      remaining: {
        amount: { amount: 1300, currency: 'MXN' },
        reserveGap: { amount: 1300, currency: 'MXN' },
        unplannedOverflow: { amount: 0, currency: 'MXN' },
        status: 'confirmed',
      },
      goals: [],
      debts: [],
    });

    let snapshot: any = null;

    function Probe() {
      snapshot = useDashboard();
      return null;
    }

    await act(async () => {
      create(<Probe />);
      await flushMicrotasks();
    });

    expect(getDashboardSummary).toHaveBeenCalledTimes(1);
    expect(snapshot?.summary?.quincena.id).toBe('q1');
  });

  it('funciona sin red: carga desde repositorio local sin usar fetch', async () => {
    useDatabaseContext.mockReturnValue({ db: {} });
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    getDashboardSummary.mockResolvedValue({
      quincena: { id: 'q-offline', label: 'Q offline', startsAt: '2026-05-01', endsAt: '2026-05-15' },
      state: 'partial',
      missing: ['income'],
      real: {
        liquidity: { amount: 800, currency: 'MXN' },
        debtTotal: { amount: 0, currency: 'MXN' },
        netWorth: { amount: 800, currency: 'MXN' },
        actualExpense: { amount: 300, currency: 'MXN' },
      },
      planned: {
        income: { amount: 0, currency: 'MXN' },
        plannedVariable: { amount: 500, currency: 'MXN' },
        committedFixed: { amount: 100, currency: 'MXN' },
        reservedTotal: { amount: 600, currency: 'MXN' },
      },
      remaining: {
        amount: { amount: -100, currency: 'MXN' },
        reserveGap: { amount: 300, currency: 'MXN' },
        unplannedOverflow: { amount: 0, currency: 'MXN' },
        status: 'incomplete',
      },
      goals: [],
      debts: [],
    });

    let snapshot: any = null;

    function Probe() {
      snapshot = useDashboard();
      return null;
    }

    await act(async () => {
      create(<Probe />);
      await flushMicrotasks();
    });

    expect(getDashboardSummary).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(snapshot?.summary?.quincena.id).toBe('q-offline');

    fetchSpy.mockRestore();
  });
});
