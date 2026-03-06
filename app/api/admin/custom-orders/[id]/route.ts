import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { createServiceClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

type ThreadStatus = "Pending Review" | "Quoted" | "Confirmed" | "Rejected";

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

type MessageRow = {
  id: string;
  thread_id: string;
  sender_role: "customer" | "admin";
  body: string;
  created_at: string;
};

type QuoteRow = {
  id: string;
  thread_id: string;
  title: string;
  item_description: string;
  quantity: number;
  unit_price: number | string;
  quoted_total: number | string;
  delivery_date: string | null;
  notes: string | null;
  status: "Sent" | "Accepted" | "Declined" | "Superseded";
  created_at: string;
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function GET(_req: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: thread, error: threadError } = await supabase
    .from("custom_order_threads")
    .select("id, customer_user_id, status, accepted_quote_id, updated_at")
    .eq("id", id)
    .single();

  if (threadError || !thread) {
    return NextResponse.json({ error: threadError?.message ?? "Custom request not found" }, { status: 404 });
  }

  await supabase
    .from("custom_order_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("thread_id", id)
    .eq("sender_role", "customer")
    .is("read_at", null);

  const [{ data: profile }, { data: messages, error: messagesError }, { data: quotes, error: quotesError }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone").eq("id", thread.customer_user_id).maybeSingle(),
    supabase
      .from("custom_order_messages")
      .select("id, thread_id, sender_role, body, created_at")
      .eq("thread_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("custom_order_quotes")
      .select("id, thread_id, title, item_description, quantity, unit_price, quoted_total, delivery_date, notes, status, created_at")
      .eq("thread_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }

  if (quotesError) {
    return NextResponse.json({ error: quotesError.message }, { status: 500 });
  }

  const typedProfile = (profile as ProfileRow | null) ?? null;

  return NextResponse.json({
    request: {
      id: thread.id,
      customer: {
        id: thread.customer_user_id,
        name: typedProfile?.full_name ?? "Customer",
        phone: typedProfile?.phone ?? "",
      },
      status: thread.status,
      acceptedQuoteId: thread.accepted_quote_id,
      messages: ((messages ?? []) as MessageRow[]).map((message) => ({
        id: message.id,
        role: message.sender_role === "customer" ? "customer" : "admin",
        content: message.body,
        timestamp: formatTimestamp(message.created_at),
        createdAt: message.created_at,
      })),
      quotes: ((quotes ?? []) as QuoteRow[]).map((quote) => ({
        id: quote.id,
        title: quote.title,
        itemDescription: quote.item_description,
        quantity: Number(quote.quantity ?? 0),
        unitPrice: Number(quote.unit_price ?? 0),
        quotedTotal: Number(quote.quoted_total ?? 0),
        deliveryDate: quote.delivery_date,
        notes: quote.notes,
        status: quote.status,
        createdAt: quote.created_at,
      })),
      updatedAt: thread.updated_at,
    },
  });
}

type PostPayload = {
  content?: string;
};

export async function POST(req: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as PostPayload;
  const content = body.content?.trim();

  if (!content) {
    return NextResponse.json({ error: "Message content is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: inserted, error: insertError } = await supabase
    .from("custom_order_messages")
    .insert({
      thread_id: id,
      sender_role: "admin",
      sender_admin_id: session.admin_id,
      body: content,
    })
    .select("id, sender_role, body, created_at")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message ?? "Failed to send message" }, { status: 500 });
  }

  await supabase
    .from("custom_order_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({
    message: {
      id: inserted.id,
      role: inserted.sender_role === "customer" ? "customer" : "admin",
      content: inserted.body,
      timestamp: formatTimestamp(inserted.created_at),
      createdAt: inserted.created_at,
    },
  });
}

type QuoteInput = {
  title?: string;
  itemDescription?: string;
  quantity?: number;
  unitPrice?: number;
  deliveryDate?: string | null;
  notes?: string | null;
};

type PatchPayload = {
  status?: ThreadStatus;
  quote?: QuoteInput;
};

export async function PATCH(req: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as PatchPayload;
  const supabase = createServiceClient();

  if (body.quote) {
    const quantity = Number(body.quote.quantity);
    const unitPrice = Number(body.quote.unitPrice);
    const itemDescription = body.quote.itemDescription?.trim();

    if (!itemDescription || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      return NextResponse.json({ error: "Complete quotation fields first" }, { status: 400 });
    }

    const { data: insertedQuote, error: insertQuoteError } = await supabase
      .from("custom_order_quotes")
      .insert({
        thread_id: id,
        created_by_admin_id: session.admin_id,
        title: body.quote.title?.trim() || "Custom Order Quote",
        item_description: itemDescription,
        quantity: Math.floor(quantity),
        unit_price: unitPrice,
        delivery_date: body.quote.deliveryDate || null,
        notes: body.quote.notes?.trim() || null,
        status: "Sent",
      })
      .select("id, title, item_description, quantity, unit_price, quoted_total, delivery_date, notes, status, created_at")
      .single();

    if (insertQuoteError || !insertedQuote) {
      return NextResponse.json({ error: insertQuoteError?.message ?? "Failed to send quotation" }, { status: 500 });
    }

    await supabase
      .from("custom_order_quotes")
      .update({ status: "Superseded" })
      .eq("thread_id", id)
      .neq("id", insertedQuote.id)
      .in("status", ["Sent", "Accepted"]);

    await supabase
      .from("custom_order_threads")
      .update({
        status: "Quoted",
        accepted_quote_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({
      quote: {
        id: insertedQuote.id,
        title: insertedQuote.title,
        itemDescription: insertedQuote.item_description,
        quantity: Number(insertedQuote.quantity ?? 0),
        unitPrice: Number(insertedQuote.unit_price ?? 0),
        quotedTotal: Number(insertedQuote.quoted_total ?? 0),
        deliveryDate: insertedQuote.delivery_date,
        notes: insertedQuote.notes,
        status: insertedQuote.status,
        createdAt: insertedQuote.created_at,
      },
    });
  }

  if (body.status && ["Pending Review", "Quoted", "Confirmed", "Rejected"].includes(body.status)) {
    const { error: updateError } = await supabase
      .from("custom_order_threads")
      .update({
        status: body.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid update payload" }, { status: 400 });
}

