import { notFound } from "next/navigation";
import { TestPayment } from "../../../components/order/TestPayment.tsx";
import { orderStatus, type OrderProgress } from "../../../server/order-status.ts";
import { simulatedPaymentsEnabled } from "../../../server/payments.ts";
import { prodDeps } from "../../../server/prod-deps.ts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pay for your order" };

// Demo stand-in for a payment gateway's checkout page. A real gateway replaces this route. 404 in production.
export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  if (!simulatedPaymentsEnabled()) notFound();
  const { token } = await params;
  const res = await orderStatus(token, prodDeps());
  if (!res.ok) notFound();
  const order: OrderProgress = await res.json();
  return <TestPayment token={token} order={order} />;
}
