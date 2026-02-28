import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { createServiceClient } from "@/lib/supabase/server";

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  price: number | string;
  subtotal: number | string;
};

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      user_id,
      order_number,
      customer_name,
      customer_phone,
      payment_method,
      payment_status,
      delivery_mode,
      delivery_address,
      delivery_lat,
      delivery_lng,
      subtotal,
      delivery_fee,
      total,
      status,
      created_at,
      admin_note
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orderIds = (orders ?? []).map((order) => order.id);
  const itemsByOrderId: Record<string, OrderItemRow[]> = {};

  if (orderIds.length > 0) {
    const { data: items, error: itemError } = await supabase
      .from("order_items")
      .select("id, order_id, product_id, name, quantity, price, subtotal")
      .in("order_id", orderIds)
      .order("created_at", { ascending: true });

    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 });
    }

    for (const item of (items ?? []) as OrderItemRow[]) {
      if (!itemsByOrderId[item.order_id]) {
        itemsByOrderId[item.order_id] = [];
      }
      itemsByOrderId[item.order_id].push(item);
    }
  }

  const payload = (orders ?? []).map((order) => ({
    id: order.id,
    userId: order.user_id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    deliveryMode: order.delivery_mode,
    deliveryAddress: order.delivery_address,
    deliveryLat: order.delivery_lat === null ? null : Number(order.delivery_lat),
    deliveryLng: order.delivery_lng === null ? null : Number(order.delivery_lng),
    subtotal: Number(order.subtotal ?? 0),
    deliveryFee: Number(order.delivery_fee ?? 0),
    total: Number(order.total ?? 0),
    status: order.status,
    createdAt: order.created_at,
    adminNote: order.admin_note,
    rejectionReason: null,
    rated: false,
    rating: null,
    ratingNote: null,
    deliveryTimeMinutes: null,
    items: (itemsByOrderId[order.id] ?? []).map((item) => ({
      id: item.id,
      productId: item.product_id,
      name: item.name,
      qty: Number(item.quantity ?? 0),
      price: Number(item.price ?? 0),
      subtotal: Number(item.subtotal ?? 0),
    })),
  }));

  return NextResponse.json({ orders: payload });
}
