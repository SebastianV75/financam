import type { FinancialPlanRecord, OperationalMovementRecord, QuincenaId } from './types';

export interface FinanceRepository {
  listPlanByQuincena(quincenaId: QuincenaId): Promise<FinancialPlanRecord[]>;
  listMovementsByQuincena(quincenaId: QuincenaId): Promise<OperationalMovementRecord[]>;
}
