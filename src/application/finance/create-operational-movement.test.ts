import { createOperationalMovement } from './create-operational-movement';

describe('createOperationalMovement', () => {
  const repository = {
    createOperationalMovement: jest.fn().mockImplementation(async (input) => input),
  };

  const base = {
    id: 'm1',
    quincenaId: 'q1',
    occurredAt: '2026-01-01T00:00:00Z',
    amount: { amount: 100, currency: 'MXN' as const },
    fromAccountId: null,
    toAccountId: null,
    categoryId: null,
  };

  it('rechaza income sin cuenta destino', async () => {
    await expect(
      createOperationalMovement(repository as never, { ...base, kind: 'income', categoryId: 'cat-1' }),
    ).rejects.toThrow('Ingreso requiere cuenta destino.');
  });

  it('rechaza expense sin categoría', async () => {
    await expect(
      createOperationalMovement(repository as never, { ...base, kind: 'expense', fromAccountId: 'a1' }),
    ).rejects.toThrow('Gasto requiere categoría.');
  });

  it('rechaza transferencia con origen igual a destino', async () => {
    await expect(
      createOperationalMovement(repository as never, {
        ...base,
        kind: 'transfer',
        fromAccountId: 'a1',
        toAccountId: 'a1',
      }),
    ).rejects.toThrow('Transferencia inválida');
  });

  it('rechaza transferencia incompleta sin origen', async () => {
    await expect(
      createOperationalMovement(repository as never, {
        ...base,
        kind: 'transfer',
        fromAccountId: null,
        toAccountId: 'a2',
      }),
    ).rejects.toThrow('Transferencia requiere cuenta origen y destino.');
  });

  it('rechaza transferencia incompleta sin destino', async () => {
    await expect(
      createOperationalMovement(repository as never, {
        ...base,
        kind: 'transfer',
        fromAccountId: 'a1',
        toAccountId: null,
      }),
    ).rejects.toThrow('Transferencia requiere cuenta origen y destino.');
  });

  it('acepta gasto válido con origen y categoría', async () => {
    const result = await createOperationalMovement(repository as never, {
      ...base,
      kind: 'expense',
      fromAccountId: 'a1',
      categoryId: 'cat-1',
    });

    expect(result.kind).toBe('expense');
    expect(repository.createOperationalMovement).toHaveBeenCalled();
  });

  it('acepta transferencia válida sin categoría', async () => {
    const result = await createOperationalMovement(repository as never, {
      ...base,
      kind: 'transfer',
      fromAccountId: 'a1',
      toAccountId: 'a2',
    });

    expect(result.kind).toBe('transfer');
    expect(repository.createOperationalMovement).toHaveBeenCalled();
  });
});
