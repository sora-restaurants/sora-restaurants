import { OrderTracker } from "../../../components/order/OrderTracker.tsx";

export const metadata = { title: "Your order" };

// The private link a customer gets after ordering: /o/<status token>.
export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <OrderTracker token={token} />;
}
