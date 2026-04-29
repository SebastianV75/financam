import { FinanceScreen } from '@/presentation/finance/finance-screen';

export default function PlanScreen() {
  return (
    <FinanceScreen
      title="Plan financiero"
      subtitle="Foundation del flujo quincenal. Aquí vivirá la planeación separada de los movimientos reales."
      mode="plan"
    />
  );
}
