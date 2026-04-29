import { Text, View } from 'react-native';

import { useFinanceFoundation } from './use-finance-foundation';

interface FinanceScreenProps {
  title: string;
  subtitle: string;
  mode: 'plan' | 'movements';
}

const FOUNDATION_QUINCENA_ID = 'foundation-current';

export function FinanceScreen({ mode, subtitle, title }: FinanceScreenProps) {
  const { counts, error, state } = useFinanceFoundation(FOUNDATION_QUINCENA_ID);

  return (
    <View className="flex-1 bg-background px-5 py-6">
      <Text className="text-2xl font-semibold text-text">{title}</Text>
      <Text className="mt-2 text-sm leading-5 text-muted">{subtitle}</Text>

      <View className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <Text className="text-sm font-medium uppercase tracking-wide text-muted">Estado del foundation</Text>
        <Text className="mt-3 text-base text-text">Modo: {mode === 'plan' ? 'Planeación' : 'Operación'}</Text>
        <Text className="mt-2 text-base text-text">Estado de lectura: {state}</Text>
        <Text className="mt-2 text-base text-text">Registros de plan: {counts.plan}</Text>
        <Text className="mt-2 text-base text-text">Registros de movimientos: {counts.movements}</Text>
        {error ? <Text className="mt-3 text-sm text-danger">{error}</Text> : null}
      </View>
    </View>
  );
}
