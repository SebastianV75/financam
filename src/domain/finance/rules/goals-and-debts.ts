import { differenceInCalendarDays, parseISO } from 'date-fns';

export function clampProgress(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function calculateSavingsGoalProgress(currentAmount: number, targetAmount: number): number {
  if (targetAmount <= 0) return currentAmount > 0 ? 1 : 0;
  return clampProgress(currentAmount / targetAmount);
}

export function calculatePendingSavingsAmount(currentAmount: number, targetAmount: number): number {
  return Math.max(targetAmount - currentAmount, 0);
}

function resolveRemainingBiweeks(asOfDate: string, targetDate: string): number {
  const remainingDays = differenceInCalendarDays(parseISO(targetDate), parseISO(asOfDate));
  if (remainingDays <= 0) return 1;
  return Math.max(1, Math.ceil(remainingDays / 14));
}

export function calculateSuggestedBiweeklyContribution(input: {
  currentAmount: number;
  targetAmount: number;
  targetDate: string | null;
  asOfDate: string;
}): number {
  const pending = calculatePendingSavingsAmount(input.currentAmount, input.targetAmount);
  if (pending <= 0) return 0;
  if (!input.targetDate) return 0;
  const biweeks = resolveRemainingBiweeks(input.asOfDate, input.targetDate);
  return Math.ceil(pending / biweeks);
}

export function calculateDebtProgress(currentBalance: number, principalAmount: number): number {
  if (principalAmount <= 0) return currentBalance <= 0 ? 1 : 0;
  return clampProgress((principalAmount - currentBalance) / principalAmount);
}

export function calculateDebtPaidAmount(currentBalance: number, principalAmount: number): number {
  return Math.max(principalAmount - currentBalance, 0);
}
