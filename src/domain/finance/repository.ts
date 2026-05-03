import type {
  Account,
  AccountBalance,
  Category,
  CreateAccountInput,
  CreateCategoryInput,
  FinancialPlanRecord,
  ApplyPayrollDistributionInput,
  ApplyPayrollDistributionResult,
  OperationalSnapshot,
  Quincena,
  OperationalMovementDraft,
  OperationalMovementRecord,
  PayrollDistribution,
  QuincenaId,
  SavePayrollDistributionDraftInput,
} from './types';

export interface FinanceRepository {
  getQuincenaById(id: QuincenaId): Promise<Quincena | null>;
  ensureQuincenaForDate(date: string | Date): Promise<Quincena>;
  listQuincenasByMonth(month: `${number}-${number}`): Promise<Quincena[]>;
  getOperationalSnapshotByQuincena(id: QuincenaId): Promise<OperationalSnapshot>;
  listPlanByQuincena(quincenaId: QuincenaId): Promise<FinancialPlanRecord[]>;
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
}
