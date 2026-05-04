import {
  calculateDebtProgress,
  calculatePendingSavingsAmount,
  calculateSavingsGoalProgress,
  calculateSuggestedBiweeklyContribution,
} from './goals-and-debts';

describe('goals-and-debts rules', () => {
  it('calcula progreso y aporte sugerido con fecha objetivo', () => {
    expect(calculateSavingsGoalProgress(200, 1000)).toBe(0.2);
    expect(calculatePendingSavingsAmount(200, 1000)).toBe(800);
    expect(
      calculateSuggestedBiweeklyContribution({
        currentAmount: 200,
        targetAmount: 1000,
        targetDate: '2026-06-01',
        asOfDate: '2026-05-01',
      }),
    ).toBe(267);
  });

  it('retorna 0 cuando meta está completada o sin fecha', () => {
    expect(
      calculateSuggestedBiweeklyContribution({
        currentAmount: 1000,
        targetAmount: 1000,
        targetDate: '2026-06-01',
        asOfDate: '2026-05-01',
      }),
    ).toBe(0);
    expect(
      calculateSuggestedBiweeklyContribution({
        currentAmount: 100,
        targetAmount: 1000,
        targetDate: null,
        asOfDate: '2026-05-01',
      }),
    ).toBe(0);
  });

  it('cubre principal 0, fecha vencida y clamp de progreso', () => {
    expect(calculateDebtProgress(0, 0)).toBe(1);
    expect(calculateDebtProgress(200, 100)).toBe(0);
    expect(calculateSavingsGoalProgress(2000, 1000)).toBe(1);
    expect(
      calculateSuggestedBiweeklyContribution({
        currentAmount: 100,
        targetAmount: 1000,
        targetDate: '2026-04-15',
        asOfDate: '2026-05-01',
      }),
    ).toBe(900);
  });
});
