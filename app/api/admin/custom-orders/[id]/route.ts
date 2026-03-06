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
  unit_price: number | string | null;
  quoted_total: number | string;
  delivery_date: string | null;
  notes: string | null;
  status: "Sent" | "Accepted" | "Declined" | "Superseded";
  quote_phase: "blank_from_admin" | "filled_by_customer" | "priced_by_admin";
  customer_submitted_at: string | null;
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
      .select("id, thread_id, title, item_description, quantity, unit_price, quoted_total, delivery_date, notes, status, quote_phase, customer_submitted_at, created_at")
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
        quotePhase: quote.quote_phase,
        customerSubmittedAt: quote.customer_submitted_at,
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
  action?: "send_blank" | "set_price";
  quoteId?: string;
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
    const action = body.quote.action ?? "send_blank";

    if (action === "send_blank") {
      const { data: insertedQuote, error: insertQuoteError } = await supabase
        .from("custom_order_quotes")
        .insert({
          thread_id: id,
          created_by_admin_id: session.admin_id,
          title: body.quote.title?.trim() || "Custom Order Quote",
          item_description: "",
          quantity: 1,
          unit_price: null,
          delivery_date: null,
          notes: body.quote.notes?.trim() || null,
          status: "Sent",
          quote_phase: "blank_from_admin",
        })
        .select("id, title, item_description, quantity, unit_price, quoted_total, delivery_date, notes, status, quote_phase, customer_submitted_at, created_at")
        .single();

      if (insertQuoteError || !insertedQuote) {
        return NextResponse.json({ error: insertQuoteError?.message ?? "Failed to send blank quotation" }, { status: 500 });
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
          status: "Pending Review",
          accepted_quote_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      await supabase.from("custom_order_messages").insert({
        thread_id: id,
        sender_role: "admin",
        sender_admin_id: session.admin_id,
        body: "I sent a blank quotation card. Please fill your custom order details.",
      });

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
          quotePhase: insertedQuote.quote_phase,
          customerSubmittedAt: insertedQuote.customer_submitted_at,
          createdAt: insertedQuote.created_at,
        },
      });
    }

    if (action === "set_price") {
      const quoteId = body.quote.quoteId?.trim();
      const unitPrice = Number(body.quote.unitPrice);
      if (!quoteId || !Number.isFinite(unitPrice) || unitPrice < 0) {
        return NextResponse.json({ error: "Quote ID and valid price are required" }, { status: 400 });
      }

      const { data: quote, error: quoteError } = await supabase
        .from("custom_order_quotes")
        .select("id, thread_id, item_description, quantity, title, delivery_date, notes, quote_phase")
        .eq("id", quoteId)
        .eq("thread_id", id)
        .single();

      if (quoteError || !quote) {
        return NextResponse.json({ error: quoteError?.message ?? "Quotation not found" }, { status: 404 });
      }

      if (!quote.item_description || Number(quote.quantity) <= 0) {
        return NextResponse.json({ error: "Customer details are still incomplete" }, { status: 400 });
      }

      const { data: updatedQuote, error: updateQuoteError } = await supabase
        .from("custom_order_quotes")
        .update({
          unit_price: unitPrice,
          status: "Sent",
          quote_phase: "priced_by_admin",
          notes: body.quote.notes?.trim() || quote.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", quoteId)
        .select("id, title, item_description, quantity, unit_price, quoted_total, delivery_date, notes, status, quote_phase, customer_submitted_at, created_at")
        .single();

      if (updateQuoteError || !updatedQuote) {
        return NextResponse.json({ error: updateQuoteError?.message ?? "Failed to set quotation price" }, { status: 500 });
      }

      await supabase
        .from("custom_order_threads")
        .update({
          status: "Quoted",
          accepted_quote_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      await supabase.from("custom_order_messages").insert({
        thread_id: id,
        sender_role: "admin",
        sender_admin_id: session.admin_id,
        body: "I updated your quotation with price. Please review it.",
      });

      return NextResponse.json({
        quote: {
          id: updatedQuote.id,
          title: updatedQuote.title,
          itemDescription: updatedQuote.item_description,
          quantity: Number(updatedQuote.quantity ?? 0),
          unitPrice: Number(updatedQuote.unit_price ?? 0),
          quotedTotal: Number(updatedQuote.quoted_total ?? 0),
          deliveryDate: updatedQuote.delivery_date,
          notes: updatedQuote.notes,
          status: updatedQuote.status,
          quotePhase: updatedQuote.quote_phase,
          customerSubmittedAt: updatedQuote.customer_submitted_at,
          createdAt: updatedQuote.created_at,
        },
      });
    }

    return NextResponse.json({ error: "Invalid quotation action" }, { status: 400 });
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

