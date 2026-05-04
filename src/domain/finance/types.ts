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
  accountId: string | null;
  isFixed: boolean;
  fixedExpenseId: string | null;
  planned: Money;
}

export interface SaveFinancialPlanInput {
  id: string;
  quincenaId: QuincenaId;
  categoryId: string;
  accountId: string | null;
  isFixed: boolean;
  fixedExpenseId: string | null;
  planned: Money;
}

export type FixedExpenseFrequency = 'quincenal' | 'mensual';

export interface FixedExpense {
  id: string;
  name: string;
  amount: Money;
  categoryId: string;
  accountId: string | null;
  frequency: FixedExpenseFrequency;
  isActive: boolean;
}

export interface CreateFixedExpenseInput {
  id: string;
  name: string;
  amount: Money;
  categoryId: string;
  accountId: string | null;
  frequency: FixedExpenseFrequency;
}

export interface UpdateFixedExpenseInput {
  id: string;
  name: string;
  amount: Money;
  categoryId: string;
  accountId: string | null;
  frequency: FixedExpenseFrequency;
}

export type FixedExpenseProjectionStatus = 'pending' | 'linked';

export interface FixedExpenseProjection {
  id: string;
  fixedExpenseId: string;
  quincenaId: QuincenaId;
  categoryId: string;
  accountId: string | null;
  amount: Money;
  status: FixedExpenseProjectionStatus;
  financialPlanId: string | null;
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
  goalId?: string | null;
  debtId?: string | null;
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
  goalId?: string | null;
  debtId?: string | null;
  note?: string | null;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: Money;
  targetDate: LocalDateISO | null;
  currentAmount: Money;
  accountId: string | null;
  categoryId: string | null;
}

export interface SavingsGoalSummary {
  goalId: string;
  progress: number;
  pendingAmount: Money;
  suggestedBiweeklyContribution: Money;
}

export interface SavingsGoalDraft {
  id: string;
  name: string;
  targetAmount: Money;
  targetDate: LocalDateISO | null;
  accountId: string | null;
  categoryId: string | null;
}

export interface Debt {
  id: string;
  accountId: string;
  principalAmount: Money;
  currentBalance: Money;
  interestRate: number | null;
  minPayment: Money | null;
  dueDay: number | null;
  status: 'active' | 'paid';
}

export interface DebtDraft {
  id: string;
  accountId: string;
  principalAmount: Money;
  currentBalance: Money;
  interestRate: number | null;
  minPayment: Money | null;
  dueDay: number | null;
}

export interface DebtSummary {
  debtId: string;
  progress: number;
  paidAmount: Money;
  remainingBalance: Money;
}

export interface AccountBalance {
  accountId: string;
  balance: Money;
}

export type PayrollDistributionStatus = 'draft' | 'applied';
export type PayrollDistributionTargetType = 'account' | 'category';

export interface PayrollDistributionEntry {
  id: string;
  distributionId: string;
  targetType: PayrollDistributionTargetType;
  targetId: string;
  allocated: Money;
  sortOrder: number;
}

export interface PayrollDistribution {
  id: string;
  quincenaId: QuincenaId;
  total: Money;
  status: PayrollDistributionStatus;
  incomeMovementId: string | null;
  appliedAt: string | null;
  entries: PayrollDistributionEntry[];
}

export interface PayrollDistributionApplication {
  id: string;
  distributionId: string;
  incomeMovementId: string | null;
  appliedAt: string;
}

export interface SavePayrollDistributionDraftInput {
  id: string;
  quincenaId: QuincenaId;
  total: Money;
  entries: PayrollDistributionEntry[];
}

export interface ApplyPayrollDistributionInput {
  applicationId: string;
  distributionId: string;
  incomeMovementId: string;
  appliedAt: string;
}

export interface ApplyPayrollDistributionResult {
  distribution: PayrollDistribution;
  application: PayrollDistributionApplication;
  createdMovementIds: string[];
  alreadyApplied: boolean;
}

export interface OperationalSnapshot {
  quincena: Quincena;
  movements: OperationalMovementRecord[];
}
