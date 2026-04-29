import { FinanceScreen } from '@/presentation/finance/finance-screen';

export default function MovimientosScreen() {
  return (
    <FinanceScreen
      title="Movimientos"
      subtitle="Foundation del registro operativo. Aquí vivirá la captura de ingresos, gastos y transferencias."
      mode="movements"
    />
  );
}
