import type {
  Account,
  AccountBalance,
  Category,
  CreateAccountInput,
  CreateCategoryInput,
  Debt,
  DebtDraft,
  DebtSummary,
  CreateFixedExpenseInput,
  FinancialPlanRecord,
  FixedExpense,
  FixedExpenseProjection,
  ApplyPayrollDistributionInput,
  ApplyPayrollDistributionResult,
  OperationalSnapshot,
  LocalDateISO,
  Quincena,
  OperationalMovementDraft,
  OperationalMovementRecord,
  PayrollDistribution,
  QuincenaId,
  SaveFinancialPlanInput,
  SavePayrollDistributionDraftInput,
  SavingsGoal,
  SavingsGoalDraft,
  SavingsGoalSummary,
  UpdateFixedExpenseInput,
} from './types';

export interface FinanceRepository {
  getQuincenaById(id: QuincenaId): Promise<Quincena | null>;
  ensureQuincenaForDate(date: string | Date): Promise<Quincena>;
  listQuincenasByMonth(month: `${number}-${number}`): Promise<Quincena[]>;
  getOperationalSnapshotByQuincena(id: QuincenaId): Promise<OperationalSnapshot>;
  listPlanByQuincena(quincenaId: QuincenaId): Promise<FinancialPlanRecord[]>;
  saveFinancialPlan(input: SaveFinancialPlanInput): Promise<FinancialPlanRecord>;
  listFinancialPlansByQuincena(quincenaId: QuincenaId): Promise<FinancialPlanRecord[]>;
  createFixedExpense(input: CreateFixedExpenseInput): Promise<FixedExpense>;
  updateFixedExpense(input: UpdateFixedExpenseInput): Promise<FixedExpense>;
  deactivateFixedExpense(id: string): Promise<void>;
  listFixedExpenses(): Promise<FixedExpense[]>;
  refreshFixedExpenseProjections(quincenaId: QuincenaId): Promise<void>;
  listFixedExpenseProjectionsByQuincena(quincenaId: QuincenaId): Promise<FixedExpenseProjection[]>;
  listAccounts(): Promise<Account[]>;
  createAccount(input: CreateAccountInput): Promise<Account>;
  listCategories(): Promise<Category[]>;
  createCategory(input: CreateCategoryInput): Promise<Category>;
  createOperationalMovement(input: OperationalMovementDraft): Promise<OperationalMovementRecord>;
  listMovementsByQuincena(quincenaId: QuincenaId): Promise<OperationalMovementRecord[]>;
  getAccountBalances(): Promise<AccountBalance[]>;
  savePayrollDistributionDraft(input: SavePayrollDistributionDraftInput): Promise<PayrollDistribution>;
  getPayrollDistributionByQuincena(quincenaId: QuincenaId): Promise<PayrollDistribution | null>;
  getPayrollDistributionById(distributionId: string): Promise<PayrollDistribution | null>;
  applyPayrollDistribution(input: ApplyPayrollDistributionInput): Promise<ApplyPayrollDistributionResult>;
  listAppliedMovementsByDistribution(distributionId: string): Promise<OperationalMovementRecord[]>;
  createSavingsGoal(input: SavingsGoalDraft): Promise<SavingsGoal>;
  updateSavingsGoal(input: SavingsGoalDraft): Promise<SavingsGoal>;
  getSavingsGoalById(goalId: string): Promise<SavingsGoal | null>;
  listSavingsGoals(): Promise<SavingsGoal[]>;
  createDebt(input: DebtDraft): Promise<Debt>;
  updateDebt(input: DebtDraft): Promise<Debt>;
  getDebtById(debtId: string): Promise<Debt | null>;
  listDebts(): Promise<Debt[]>;
  recordGoalContribution(input: OperationalMovementDraft): Promise<{ movement: OperationalMovementRecord; goal: SavingsGoal }>;
  recordDebtPayment(input: OperationalMovementDraft): Promise<{ movement: OperationalMovementRecord; debt: Debt }>;
  getSavingsGoalSummary(goalId: string, asOfDate: LocalDateISO): Promise<SavingsGoalSummary>;
  getDebtSummary(debtId: string): Promise<DebtSummary>;
}
