import { DEFAULT_CURRENCY } from '@/shared/constants/app';

export type QuincenaId = string;

export type CurrencyCode = typeof DEFAULT_CURRENCY;

export interface Money {
  amount: number;
  currency: CurrencyCode;
}

export interface FinancialPlanRecord {
  id: string;
  quincenaId: QuincenaId;
  categoryId: string;
  planned: Money;
}

export type MovementKind = 'expense' | 'income' | 'transfer';

export interface OperationalMovementRecord {
  id: string;
  quincenaId: QuincenaId;
  occurredAt: string;
  kind: MovementKind;
  amount: Money;
}
