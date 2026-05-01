import type {
  Account,
  AccountBalance,
  Category,
  CreateAccountInput,
  CreateCategoryInput,
  FinancialPlanRecord,
  OperationalMovementDraft,
  OperationalMovementRecord,
  QuincenaId,
} from './types';

export interface FinanceRepository {
  listPlanByQuincena(quincenaId: QuincenaId): Promise<FinancialPlanRecord[]>;
  listAccounts(): Promise<Account[]>;
  createAccount(input: CreateAccountInput): Promise<Account>;
  listCategories(): Promise<Category[]>;
  createCategory(input: CreateCategoryInput): Promise<Category>;
  createOperationalMovement(input: OperationalMovementDraft): Promise<OperationalMovementRecord>;
  listMovementsByQuincena(quincenaId: QuincenaId): Promise<OperationalMovementRecord[]>;
  getAccountBalances(): Promise<AccountBalance[]>;
}
