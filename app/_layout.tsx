import '../global.css';

import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppProviders } from '@/presentation/providers/app-providers';

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <Slot />
    </AppProviders>
  );
}
