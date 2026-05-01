import type { Account, CreateAccountInput, FinanceRepository } from '@/domain/finance';

const VALID_ACCOUNT_TYPES = new Set(['cash', 'debit', 'savings', 'credit_card']);

export async function createAccount(repository: FinanceRepository, input: CreateAccountInput): Promise<Account> {
  if (!input.name.trim()) {
    throw new Error('El nombre de la cuenta es obligatorio.');
  }

  if (!VALID_ACCOUNT_TYPES.has(input.type)) {
    throw new Error('El tipo de cuenta no es válido.');
  }

  return repository.createAccount({ ...input, name: input.name.trim() });
}
