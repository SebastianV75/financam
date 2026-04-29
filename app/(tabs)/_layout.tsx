import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: 'center',
        tabBarActiveTintColor: '#0F766E',
      }}
    >
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          headerTitle: 'Plan quincenal',
        }}
      />
      <Tabs.Screen
        name="movimientos"
        options={{
          title: 'Movimientos',
          headerTitle: 'Movimientos',
        }}
      />
    </Tabs>
  );
}
