import type { FinanceRepository } from '@/domain/finance';

export async function ensureCurrentQuincena(repository: FinanceRepository, now: Date = new Date()) {
  return repository.ensureQuincenaForDate(now);
}
