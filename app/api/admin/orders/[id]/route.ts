import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { createServiceClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };
type SupportedOrderStatus = "Pending" | "Preparing" | "Out for Delivery" | "Delivered" | "Cancelled";

type PatchPayload = {
  status?: SupportedOrderStatus;
  adminNote?: string;
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

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .update(payload)
    .eq("id", id)
    .select("id, status, admin_note")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  }

  return NextResponse.json({
    order: {
      id: data.id,
      status: data.status,
      adminNote: data.admin_note,
    },
  });
}
