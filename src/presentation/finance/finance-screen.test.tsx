jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));

import renderer from 'react-test-renderer';

import { FinanceScreen } from './finance-screen';

jest.mock('./use-finance-foundation', () => ({
  useFinanceFoundation: jest.fn(),
}));

const { useFinanceFoundation } = jest.requireMock('./use-finance-foundation');

describe('FinanceScreen', () => {
  it('muestra estado mínimo de carga y captura base', () => {
    useFinanceFoundation.mockReturnValue({
      state: 'loading',
      error: null,
      summary: { accounts: 0, categories: 0, movements: 0, balances: 0 },
      accounts: [],
      categories: [],
      balances: [],
      movements: [],
      createQuickMovement: jest.fn(),
    });

    expect(() => {
      renderer.create(<FinanceScreen mode="movements" title="Movimientos" subtitle="Sub" />);
    }).not.toThrow();
  });
});
