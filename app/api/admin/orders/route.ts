import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/adminAuth';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, customer_phone, payment_method, delivery_mode, delivery_address, status, created_at, admin_note, total')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orderIds = (orders ?? []).map((o) => o.id);
  const itemsByOrderId: Record<string, Array<{ id: string; order_id: string; product_id: string | null; name: string; quantity: number; price: number | string; subtotal: number | string }>> = {};

  if (orderIds.length > 0) {
    const { data: items, error: itemError } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, name, quantity, price, subtotal')
      .in('order_id', orderIds)
      .order('created_at', { ascending: true });

    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 });
    }

    for (const item of items ?? []) {
      if (!itemsByOrderId[item.order_id]) itemsByOrderId[item.order_id] = [];
      itemsByOrderId[item.order_id].push(item);
    }
  }

  const payload = (orders ?? []).map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    paymentMethod: o.payment_method,
    deliveryMode: o.delivery_mode,
    deliveryAddress: o.delivery_address,
    status: o.status,
    createdAt: o.created_at,
    adminNote: o.admin_note,
    total: Number(o.total ?? 0),
    items: (itemsByOrderId[o.id] ?? []).map((i) => ({
      id: i.id,
      productId: i.product_id,
      name: i.name,
      qty: i.quantity,
      price: Number(i.price ?? 0),
      subtotal: Number(i.subtotal ?? 0),
    })),
  }));

  return NextResponse.json({ orders: payload });
}
