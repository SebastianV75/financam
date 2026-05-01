import { FinanceScreen } from '@/presentation/finance/finance-screen';

export default function MovimientosScreen() {
  return (
    <FinanceScreen
      title="Movimientos"
      subtitle="Registro operativo local-first: cuentas, categorías, ingresos, gastos y transferencias en SQLite."
      mode="movements"
    />
  );
}
