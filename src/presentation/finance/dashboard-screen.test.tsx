jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));

import renderer from 'react-test-renderer';

import { DashboardScreen } from './dashboard-screen';

jest.mock('./use-dashboard', () => ({
  useDashboard: jest.fn(),
}));

const { useDashboard } = jest.requireMock('./use-dashboard');

describe('DashboardScreen', () => {
  function collectText(tree: renderer.ReactTestRenderer) {
    return tree.root
      .findAll((node) => String(node.type) === 'Text')
      .map((node) => String(node.props.children ?? ''))
      .join(' ');
  }

  it('muestra mensaje explícito para estado partial', () => {
    useDashboard.mockReturnValue({
      loading: false,
      error: null,
      refresh: jest.fn(),
      summary: {
        quincena: { id: 'q1', label: 'Q1', startsAt: '2026-05-01', endsAt: '2026-05-15' },
        state: 'partial',
        missing: ['income'],
        real: {
          liquidity: { amount: 1000, currency: 'MXN' },
          debtTotal: { amount: 0, currency: 'MXN' },
          netWorth: { amount: 1000, currency: 'MXN' },
          actualExpense: { amount: 300, currency: 'MXN' },
        },
        planned: {
          income: { amount: 0, currency: 'MXN' },
          plannedVariable: { amount: 500, currency: 'MXN' },
          committedFixed: { amount: 200, currency: 'MXN' },
          reservedTotal: { amount: 700, currency: 'MXN' },
        },
        remaining: {
          amount: { amount: -300, currency: 'MXN' },
          reserveGap: { amount: 400, currency: 'MXN' },
          unplannedOverflow: { amount: 0, currency: 'MXN' },
          status: 'incomplete',
        },
        goals: [],
        debts: [],
      },
    });

    let tree: renderer.ReactTestRenderer;
    renderer.act(() => {
      tree = renderer.create(<DashboardScreen />);
    });
    const text = collectText(tree!);

    expect(text).toContain('Faltan datos por completar');
    expect(text).toContain('Pendiente:');
    expect(text).toContain('income');
    expect(text).toContain('incomplete');
  });

  it('muestra estado vacío guiado cuando no hay ingreso ni planes ni compromisos', () => {
    useDashboard.mockReturnValue({
      loading: false,
      error: null,
      refresh: jest.fn(),
      summary: {
        quincena: { id: 'q1', label: 'Q1', startsAt: '2026-05-01', endsAt: '2026-05-15' },
        state: 'empty',
        missing: ['income', 'plans', 'fixed-expenses'],
        real: {
          liquidity: { amount: 0, currency: 'MXN' },
          debtTotal: { amount: 0, currency: 'MXN' },
          netWorth: { amount: 0, currency: 'MXN' },
          actualExpense: { amount: 0, currency: 'MXN' },
        },
        planned: {
          income: { amount: 0, currency: 'MXN' },
          plannedVariable: { amount: 0, currency: 'MXN' },
          committedFixed: { amount: 0, currency: 'MXN' },
          reservedTotal: { amount: 0, currency: 'MXN' },
        },
        remaining: {
          amount: { amount: 0, currency: 'MXN' },
          reserveGap: { amount: 0, currency: 'MXN' },
          unplannedOverflow: { amount: 0, currency: 'MXN' },
          status: 'incomplete',
        },
        goals: [],
        debts: [],
      },
    });

    let tree: renderer.ReactTestRenderer;
    renderer.act(() => {
      tree = renderer.create(<DashboardScreen />);
    });
    const text = collectText(tree!);

    expect(text).toContain('Resumen incompleto');
    expect(text).toContain('Aún no hay datos base de la quincena');
  });
});
