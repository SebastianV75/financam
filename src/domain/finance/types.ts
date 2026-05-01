import { DEFAULT_CURRENCY } from '@/shared/constants/app';

export type LocalDateISO = string;
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

export interface QuincenaRange {
  startsAt: LocalDateISO;
  endsAt: LocalDateISO;
}

export interface Quincena extends QuincenaRange {
  id: QuincenaId;
  label: string;
}

export type MovementKind = 'expense' | 'income' | 'transfer';

export type AccountType = 'cash' | 'debit' | 'savings' | 'credit_card';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon?: string | null;
  isActive: boolean;
}

export interface CreateAccountInput {
  id: string;
  name: string;
  type: AccountType;
}

export interface CreateCategoryInput {
  id: string;
  name: string;
  icon?: string | null;
}

export interface OperationalMovementDraft {
  id: string;
  quincenaId: QuincenaId;
  occurredAt: string;
  kind: MovementKind;
  amount: Money;
  fromAccountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  note?: string | null;
}

export interface OperationalMovementRecord {
  id: string;
  quincenaId: QuincenaId;
  occurredAt: string;
  kind: MovementKind;
  amount: Money;
  fromAccountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  note?: string | null;
}

export interface AccountBalance {
  accountId: string;
  balance: Money;
}

export interface OperationalSnapshot {
  quincena: Quincena;
  movements: OperationalMovementRecord[];
}
