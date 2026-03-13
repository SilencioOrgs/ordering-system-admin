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

type ReceiptExtractionRow = {
  order_id: string;
  extraction_status: string;
  reference_number: string | null;
  recipient_name: string | null;
  recipient_mobile_number: string | null;
  amount: number | string | null;
  currency: string | null;
  transaction_date_text: string | null;
  transaction_timestamp: string | null;
  source_image_url: string | null;
  extraction_error: string | null;
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
      payment_proof_url,
      delivery_mode,
      delivery_address,
      region_name,
      province_name,
      city_municipality_name,
      barangay_name,
      street_address,
      landmark,
      complete_address,
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
  const receiptByOrderId: Record<string, ReceiptExtractionRow> = {};

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

    const { data: receipts, error: receiptError } = await supabase
      .from("payment_receipt_extractions")
      .select(
        `
        order_id,
        extraction_status,
        reference_number,
        recipient_name,
        recipient_mobile_number,
        amount,
        currency,
        transaction_date_text,
        transaction_timestamp,
        source_image_url,
        extraction_error
      `
      )
      .in("order_id", orderIds);

    if (receiptError) {
      return NextResponse.json({ error: receiptError.message }, { status: 500 });
    }

    for (const receipt of (receipts ?? []) as ReceiptExtractionRow[]) {
      receiptByOrderId[receipt.order_id] = receipt;
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
    paymentProofUrl: order.payment_proof_url,
    deliveryMode: order.delivery_mode,
    deliveryAddress: order.complete_address ?? order.delivery_address,
    streetAddress: order.street_address,
    barangayName: order.barangay_name,
    cityMunicipalityName: order.city_municipality_name,
    provinceName: order.province_name,
    regionName: order.region_name,
    landmark: order.landmark,
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
    receiptExtraction: receiptByOrderId[order.id]
      ? {
          extractionStatus: receiptByOrderId[order.id].extraction_status,
          referenceNumber: receiptByOrderId[order.id].reference_number,
          recipientName: receiptByOrderId[order.id].recipient_name,
          recipientMobileNumber: receiptByOrderId[order.id].recipient_mobile_number,
          amount:
            receiptByOrderId[order.id].amount === null
              ? null
              : Number(receiptByOrderId[order.id].amount),
          currency: receiptByOrderId[order.id].currency,
          transactionDateText: receiptByOrderId[order.id].transaction_date_text,
          transactionTimestamp: receiptByOrderId[order.id].transaction_timestamp,
          sourceImageUrl: receiptByOrderId[order.id].source_image_url,
          extractionError: receiptByOrderId[order.id].extraction_error,
        }
      : null,
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
