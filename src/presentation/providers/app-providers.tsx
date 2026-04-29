import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { PropsWithChildren } from 'react';

import { DatabaseProvider, useDatabaseContext } from '@/infrastructure/db/provider';

function DatabaseGate({ children }: PropsWithChildren) {
  const { error, status } = useDatabaseContext();

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <ActivityIndicator color="#0F766E" size="large" />
        <Text className="mt-4 text-center text-base text-muted">Inicializando persistencia local…</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-center text-lg font-semibold text-danger">No pudimos iniciar la base local.</Text>
        <Text className="mt-3 text-center text-sm text-muted">{error}</Text>
      </View>
    );
  }

  return children;
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <DatabaseGate>{children}</DatabaseGate>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}
