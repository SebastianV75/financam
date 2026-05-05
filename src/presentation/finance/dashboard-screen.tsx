import { Pressable, Text, View } from 'react-native';

import { useDashboard } from './use-dashboard';

function amountLabel(value: number) {
  return `$${value.toFixed(2)}`;
}

export function DashboardScreen() {
  const { summary, loading, error, refresh } = useDashboard();

  if (loading && !summary) {
    return (
      <View className="flex-1 bg-background px-5 py-6">
        <Text className="text-base text-text">Cargando dashboard...</Text>
      </View>
    );
  }

  if (!summary) {
    return (
      <View className="flex-1 bg-background px-5 py-6">
        <Text className="text-base text-text">No hay resumen disponible.</Text>
      </View>
    );
  }

  const isEmpty = summary.state === 'empty';
  const isPartial = summary.state === 'partial';

  return (
    <View className="flex-1 bg-background px-5 py-6">
      <Text className="text-2xl font-semibold text-text">Dashboard</Text>
      <Text className="mt-2 text-sm text-muted">Quincena: {summary.quincena.label}</Text>
      <Text className="mt-1 text-sm text-muted">Estado: {summary.state}</Text>

      {isEmpty ? (
        <View className="mt-3 rounded-xl border border-warning/40 bg-warning/10 p-3">
          <Text className="text-sm font-semibold text-warning">Resumen incompleto</Text>
          <Text className="mt-1 text-sm text-warning">
            Aún no hay datos base de la quincena. Registra ingreso, planes y compromisos para ver un resumen confiable.
          </Text>
        </View>
      ) : null}

      {isPartial ? (
        <View className="mt-3 rounded-xl border border-warning/40 bg-warning/10 p-3">
          <Text className="text-sm font-semibold text-warning">Faltan datos por completar</Text>
          <Text className="mt-1 text-sm text-warning">Pendiente: {summary.missing.join(', ') || 'ninguno'}.</Text>
        </View>
      ) : null}

      <View className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <Text className="text-sm font-medium uppercase tracking-wide text-muted">Resumen real</Text>
        <Text className="mt-2 text-base text-text">Liquidez: {amountLabel(summary.real.liquidity.amount)}</Text>
        <Text className="mt-2 text-base text-text">Deuda: {amountLabel(summary.real.debtTotal.amount)}</Text>
        <Text className="mt-2 text-base text-text">Patrimonio: {amountLabel(summary.real.netWorth.amount)}</Text>
      </View>

      <View className="mt-4 rounded-2xl border border-border bg-surface p-5">
        <Text className="text-sm font-medium uppercase tracking-wide text-muted">Planeación</Text>
        <Text className="mt-2 text-base text-text">Planeado: {amountLabel(summary.planned.plannedVariable.amount)}</Text>
        <Text className="mt-2 text-base text-text">Comprometido: {amountLabel(summary.planned.committedFixed.amount)}</Text>
      </View>

      <View className="mt-4 rounded-2xl border border-border bg-surface p-5">
        <Text className="text-sm font-medium uppercase tracking-wide text-muted">Remanente</Text>
        <Text className="mt-2 text-base text-text">Disponible: {amountLabel(summary.remaining.amount.amount)}</Text>
        <Text className="mt-2 text-base text-text">Estado: {summary.remaining.status}</Text>
      </View>

      {error ? <Text className="mt-3 text-sm text-danger">{error}</Text> : null}

      <Pressable className="mt-6" onPress={refresh}>
        <Text className="rounded bg-primary px-3 py-2 text-xs font-semibold text-white">Actualizar</Text>
      </Pressable>
    </View>
  );
}
