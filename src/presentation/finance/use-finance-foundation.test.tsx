import { act, create } from 'react-test-renderer';

import { useFinanceFoundation } from './use-finance-foundation';

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
  getFinanceFoundation: jest.fn(),
  getPayrollDistribution: jest.fn(),
  createOperationalMovement: jest.fn(),
}));

const { useDatabaseContext } = jest.requireMock('@/infrastructure/db/provider') as {
  useDatabaseContext: jest.Mock;
};
const { getFinanceFoundation, getPayrollDistribution } = jest.requireMock('@/application/finance') as {
  getFinanceFoundation: jest.Mock;
  getPayrollDistribution: jest.Mock;
};

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('useFinanceFoundation', () => {
  it('consulta getPayrollDistribution para la quincena activa al cargar foundation', async () => {
    useDatabaseContext.mockReturnValue({ db: {} });
    getFinanceFoundation.mockResolvedValue({
      accounts: [],
      categories: [],
      balances: [],
      movements: [],
      quincena: {
        id: 'q1',
        label: 'Q1',
        startsAt: '2026-05-01',
        endsAt: '2026-05-15',
      },
    });
    getPayrollDistribution.mockResolvedValue(null);

    function Probe() {
      useFinanceFoundation();
      return null;
    }

    await act(async () => {
      create(<Probe />);
      await flushMicrotasks();
    });

    expect(getPayrollDistribution).toHaveBeenCalledWith(expect.anything(), { quincenaId: 'q1' });
  });
});
