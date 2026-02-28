import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { createServiceClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };
type SupportedOrderStatus = "Pending" | "Preparing" | "Out for Delivery" | "Delivered" | "Cancelled";

type PatchPayload = {
  status?: SupportedOrderStatus;
  adminNote?: string;
  rejectionReason?: string;
  deliveryTimeMinutes?: number;
};

const VALID_STATUSES: SupportedOrderStatus[] = ["Pending", "Preparing", "Out for Delivery", "Delivered", "Cancelled"];

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
  if (typeof body.adminNote === "string") {
    payload.admin_note = body.adminNote;
  }
  if (typeof body.rejectionReason === "string") {
    payload.rejection_reason = body.rejectionReason;
  }
  if (typeof body.deliveryTimeMinutes === "number" && Number.isFinite(body.deliveryTimeMinutes)) {
    payload.delivery_time_minutes = Math.max(0, Math.floor(body.deliveryTimeMinutes));
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: updatedOrder, error: updateError } = await supabase
    .from("orders")
    .update(payload)
    .eq("id", id)
    .select("id, user_id, order_number, customer_name, status, admin_note, rejection_reason, delivery_time_minutes")
    .single();

  if (updateError || !updatedOrder) {
    return NextResponse.json({ error: updateError?.message ?? "Update failed" }, { status: 500 });
  }

  const nextStatus = updatedOrder.status as SupportedOrderStatus;
  const userId = updatedOrder.user_id;

  if (userId && nextStatus === "Delivered") {
    const deliveryMins =
      typeof updatedOrder.delivery_time_minutes === "number" ? updatedOrder.delivery_time_minutes : undefined;

    const receiptBody = [
      `Hi ${updatedOrder.customer_name},`,
      "",
      `Your order #${updatedOrder.order_number} has been delivered.`,
      deliveryMins !== undefined ? `Delivery time: ${deliveryMins} minutes` : "",
      "",
      "Thank you for supporting Ate Ai's Kitchen.",
    ]
      .filter((line) => line !== "")
      .join("\n");

    await supabase.from("order_messages").insert([
      {
        order_id: updatedOrder.id,
        user_id: userId,
        sender: "admin",
        message_type: "receipt",
        body: receiptBody,
      },
      {
        order_id: updatedOrder.id,
        user_id: userId,
        sender: "admin",
        message_type: "rating_prompt",
        body: `How was your order #${updatedOrder.order_number}? We'd love your feedback.`,
      },
    ]);
  }

  if (userId && nextStatus === "Cancelled") {
    const reason = updatedOrder.rejection_reason ?? "Order rejected by admin";
    const cancellationBody = [
      `We're sorry, your order #${updatedOrder.order_number} could not be accepted.`,
      "",
      `Reason: ${reason}`,
      "",
      "Please contact us if you have questions. - Ate Ai",
    ].join("\n");

    await supabase.from("order_messages").insert({
      order_id: updatedOrder.id,
      user_id: userId,
      sender: "admin",
      message_type: "general",
      body: cancellationBody,
    });
  }

  return NextResponse.json({
    order: {
      id: updatedOrder.id,
      status: updatedOrder.status,
      adminNote: updatedOrder.admin_note,
      rejectionReason: updatedOrder.rejection_reason,
      deliveryTimeMinutes: updatedOrder.delivery_time_minutes,
    },
  });
}
