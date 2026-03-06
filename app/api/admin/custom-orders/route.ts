import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { createServiceClient } from "@/lib/supabase/server";

type ThreadStatus = "Pending Review" | "Quoted" | "Confirmed" | "Rejected";

type ThreadRow = {
  id: string;
  customer_user_id: string;
  status: ThreadStatus;
  updated_at: string;
};

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
  read_at: string | null;
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

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: threads, error: threadsError } = await supabase
    .from("custom_order_threads")
    .select("id, customer_user_id, status, updated_at")
    .order("updated_at", { ascending: false });

  if (threadsError) {
    return NextResponse.json({ error: threadsError.message }, { status: 500 });
  }

  const typedThreads = (threads ?? []) as ThreadRow[];
  if (typedThreads.length === 0) {
    return NextResponse.json({ requests: [] });
  }

  const threadIds = typedThreads.map((thread) => thread.id);
  const customerIds = Array.from(new Set(typedThreads.map((thread) => thread.customer_user_id)));

  const [{ data: profiles, error: profilesError }, { data: messages, error: messagesError }, { data: quotes, error: quotesError }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone").in("id", customerIds),
    supabase
      .from("custom_order_messages")
      .select("id, thread_id, sender_role, body, created_at, read_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("custom_order_quotes")
      .select("id, thread_id, title, item_description, quantity, unit_price, quoted_total, delivery_date, notes, status, quote_phase, customer_submitted_at, created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false }),
  ]);

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }

  if (quotesError) {
    return NextResponse.json({ error: quotesError.message }, { status: 500 });
  }

  const profileById = new Map<string, ProfileRow>((profiles ?? []).map((profile) => [profile.id, profile as ProfileRow]));

  const messagesByThread = new Map<string, MessageRow[]>();
  for (const message of (messages ?? []) as MessageRow[]) {
    const existing = messagesByThread.get(message.thread_id) ?? [];
    existing.push(message);
    messagesByThread.set(message.thread_id, existing);
  }

  const latestQuoteByThread = new Map<string, QuoteRow>();
  for (const quote of (quotes ?? []) as QuoteRow[]) {
    if (!latestQuoteByThread.has(quote.thread_id)) {
      latestQuoteByThread.set(quote.thread_id, quote);
    }
  }

  const payload = typedThreads.map((thread) => {
    const profile = profileById.get(thread.customer_user_id);
    const threadMessages = messagesByThread.get(thread.id) ?? [];
    const latestMessage = threadMessages[0] ?? null;
    const unreadCount = threadMessages.filter(
      (message) => message.sender_role === "customer" && message.read_at === null
    ).length;

    const latestQuote = latestQuoteByThread.get(thread.id) ?? null;

    return {
      id: thread.id,
      customer: {
        id: thread.customer_user_id,
        name: profile?.full_name ?? "Customer",
        phone: profile?.phone ?? "",
      },
      status: thread.status,
      unreadCount,
      lastMessage: latestMessage
        ? {
            id: latestMessage.id,
            role: latestMessage.sender_role === "customer" ? "customer" : "admin",
            content: latestMessage.body,
            timestamp: formatTimestamp(latestMessage.created_at),
          }
        : null,
      latestQuote: latestQuote
        ? {
            id: latestQuote.id,
            title: latestQuote.title,
            itemDescription: latestQuote.item_description,
            quantity: Number(latestQuote.quantity ?? 0),
            unitPrice: Number(latestQuote.unit_price ?? 0),
            quotedTotal: Number(latestQuote.quoted_total ?? 0),
            deliveryDate: latestQuote.delivery_date,
            notes: latestQuote.notes,
            status: latestQuote.status,
            quotePhase: latestQuote.quote_phase,
            customerSubmittedAt: latestQuote.customer_submitted_at,
            createdAt: latestQuote.created_at,
          }
        : null,
      updatedAt: thread.updated_at,
    };
  });

  return NextResponse.json({ requests: payload });
}

