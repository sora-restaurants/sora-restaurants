import { notFound } from "next/navigation";
import { TestPayment } from "../../../components/order/TestPayment.tsx";
import { orderStatus, type OrderProgress } from "../../../server/order-status.ts";
import { canSimulateOrder, simulatedPaymentsEnabled } from "../../../server/payments.ts";
import { prodDeps } from "../../../server/prod-deps.ts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pay for your order" };

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  if (!simulatedPaymentsEnabled()) notFound();
  const { token } = await params;
  const deps = prodDeps();
  if (!(await canSimulateOrder(token, deps))) notFound();
  const res = await orderStatus(token, deps);
  if (!res.ok) notFound();
  const order: OrderProgress = await res.json();
  return <TestPayment token={token} order={order} />;
}
