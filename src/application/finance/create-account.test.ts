import { createAccount } from './create-account';

describe('createAccount', () => {
  const repository = {
    createAccount: jest.fn().mockImplementation(async (input) => ({ ...input, isActive: true })),
  };

  it('rechaza tipo inválido en cuentas', async () => {
    await expect(
      createAccount(repository as never, {
        id: 'acc-1',
        name: 'Caja',
        type: 'crypto' as never,
      }),
    ).rejects.toThrow('El tipo de cuenta no es válido.');
  });
});
