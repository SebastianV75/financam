import type {
  Account,
  AccountBalance,
  Category,
  CreateAccountInput,
  CreateCategoryInput,
  FinancialPlanRecord,
  OperationalSnapshot,
  Quincena,
  OperationalMovementDraft,
  OperationalMovementRecord,
  QuincenaId,
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
}
