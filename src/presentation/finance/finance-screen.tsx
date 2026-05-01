import { Pressable, Text, View } from 'react-native';

import { useFinanceFoundation } from './use-finance-foundation';

interface FinanceScreenProps {
  title: string;
  subtitle: string;
  mode: 'plan' | 'movements';
}

export function FinanceScreen({ mode, subtitle, title }: FinanceScreenProps) {
  const { summary, accounts, categories, balances, movements, activeQuincena, createQuickMovement, error, state } =
    useFinanceFoundation();

  return (
    <View className="flex-1 bg-background px-5 py-6">
      <Text className="text-2xl font-semibold text-text">{title}</Text>
      <Text className="mt-2 text-sm leading-5 text-muted">{subtitle}</Text>

      <View className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <Text className="text-sm font-medium uppercase tracking-wide text-muted">Estado del foundation</Text>
        <Text className="mt-3 text-base text-text">Modo: {mode === 'plan' ? 'Planeación' : 'Operación'}</Text>
        <Text className="mt-2 text-base text-text">
          Quincena activa: {activeQuincena?.label ?? 'resolviendo...'}
        </Text>
        <Text className="mt-2 text-base text-text">
          Rango: {activeQuincena ? `${activeQuincena.startsAt} → ${activeQuincena.endsAt}` : '-'}
        </Text>
        <Text className="mt-2 text-base text-text">Estado de lectura: {state}</Text>
        <Text className="mt-2 text-base text-text">Cuentas: {summary.accounts}</Text>
        <Text className="mt-2 text-base text-text">Categorías: {summary.categories}</Text>
        <Text className="mt-2 text-base text-text">Movimientos: {summary.movements}</Text>
        <Text className="mt-2 text-base text-text">Saldos derivados: {summary.balances}</Text>
        {error ? <Text className="mt-3 text-sm text-danger">{error}</Text> : null}
      </View>

      <View className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <Text className="text-sm font-medium uppercase tracking-wide text-muted">Cuentas y saldos</Text>
        {accounts.length === 0 ? <Text className="mt-2 text-sm text-muted">Sin cuentas registradas.</Text> : null}
        {accounts.map((account) => {
          const balance = balances.find((item) => item.accountId === account.id);
          return (
            <Text key={account.id} className="mt-2 text-base text-text">
              {account.name} ({account.type}) · {balance?.balance.amount ?? 0} {balance?.balance.currency ?? 'MXN'}
            </Text>
          );
        })}
      </View>

      <View className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <Text className="text-sm font-medium uppercase tracking-wide text-muted">Categorías</Text>
        {categories.length === 0 ? <Text className="mt-2 text-sm text-muted">Sin categorías registradas.</Text> : null}
        {categories.map((category) => (
          <Text key={category.id} className="mt-2 text-base text-text">
            {category.name}
          </Text>
        ))}
      </View>

      <View className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <Text className="text-sm font-medium uppercase tracking-wide text-muted">Captura rápida (MVP)</Text>
        <View className="mt-3 flex-row gap-2">
          <Pressable onPress={() => createQuickMovement({ kind: 'income', amount: 1000 })}>
            <Text className="rounded bg-primary px-3 py-2 text-xs font-semibold text-white">+ Ingreso</Text>
          </Pressable>
          <Pressable onPress={() => createQuickMovement({ kind: 'expense', amount: 500 })}>
            <Text className="rounded bg-primary px-3 py-2 text-xs font-semibold text-white">+ Gasto</Text>
          </Pressable>
          <Pressable onPress={() => createQuickMovement({ kind: 'transfer', amount: 300 })}>
            <Text className="rounded bg-primary px-3 py-2 text-xs font-semibold text-white">+ Transferencia</Text>
          </Pressable>
        </View>
        <Text className="mt-3 text-xs text-muted">Movimientos registrados en esta quincena: {movements.length}</Text>
      </View>
    </View>
  );
}
