import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { awardDeliveredOrderRewards, createUserNotification } from "@/lib/rewardService";
import { createServiceClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };
type SupportedOrderStatus = "Pending" | "Preparing" | "Out for Delivery" | "Delivered" | "Cancelled";
type SupportedPaymentStatus = "Pending" | "Awaiting Verification" | "Verified" | "Rejected";

type PatchPayload = {
  status?: SupportedOrderStatus;
  paymentStatus?: SupportedPaymentStatus;
  adminNote?: string;
};

const VALID_STATUSES: SupportedOrderStatus[] = ["Pending", "Preparing", "Out for Delivery", "Delivered", "Cancelled"];
const VALID_PAYMENT_STATUSES: SupportedPaymentStatus[] = ["Pending", "Awaiting Verification", "Verified", "Rejected"];

export async function PATCH(req: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: PatchPayload;
  try {
    body = (await req.json()) as PatchPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {};
  if (typeof body.status === "string") {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    payload.status = body.status;
  }

  if (typeof body.paymentStatus === "string") {
    if (!VALID_PAYMENT_STATUSES.includes(body.paymentStatus)) {
      return NextResponse.json({ error: "Invalid payment status" }, { status: 400 });
    }
    payload.payment_status = body.paymentStatus;
  }

  if (typeof body.adminNote === "string") {
    payload.admin_note = body.adminNote;
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: existingOrder } = await supabase
    .from("orders")
    .select(
      `
      id,
      user_id,
      order_number,
      subtotal,
      delivery_fee,
      total,
      status,
      payment_status,
      applied_reward_id,
      reward_source,
      customer_name,
      created_at
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (!existingOrder) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("orders")
    .update(payload)
    .eq("id", id)
    .select("id, user_id, order_number, subtotal, delivery_fee, total, status, payment_status, admin_note, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  }

  if (data.user_id) {
    if (payload.payment_status && payload.payment_status !== existingOrder.payment_status) {
      await createUserNotification(
        data.user_id,
        `Payment status: ${data.payment_status}`,
        `Order ${data.order_number} payment is now ${data.payment_status}.`,
        "order",
        { orderId: data.id }
      );
    }

    if (payload.status && payload.status !== existingOrder.status) {
      await createUserNotification(
        data.user_id,
        `Order ${data.order_number}: ${data.status}`,
        data.status === "Delivered"
          ? "Your order has been delivered. Please rate your experience."
          : `Your order is now ${data.status}.`,
        data.status === "Delivered" ? "rating_prompt" : "order",
        { orderId: data.id }
      );
    }
  }

  if (payload.status === "Cancelled" && existingOrder.reward_source === "user_voucher" && existingOrder.applied_reward_id) {
    await supabase
      .from("user_vouchers")
      .update({
        status: "active",
        used_order_id: null,
        used_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingOrder.applied_reward_id)
      .eq("used_order_id", data.id);
  }

  if (payload.status === "Delivered" && existingOrder.status !== "Delivered" && data.user_id) {
    await awardDeliveredOrderRewards({
      id: data.id,
      userId: data.user_id,
      orderNumber: data.order_number,
      subtotal: Number(data.subtotal ?? 0),
      deliveryFee: Number(data.delivery_fee ?? 0),
      total: Number(data.total ?? 0),
      createdAt: data.created_at,
    });
  }

  return NextResponse.json({
    order: {
      id: data.id,
      status: data.status,
      paymentStatus: data.payment_status,
      adminNote: data.admin_note,
    },
  });
}
