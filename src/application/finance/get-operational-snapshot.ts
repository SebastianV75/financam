import type { FinanceRepository, QuincenaId } from '@/domain/finance';

export async function getOperationalSnapshot(repository: FinanceRepository, quincenaId: QuincenaId) {
  return repository.getOperationalSnapshotByQuincena(quincenaId);
}
