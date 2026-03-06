import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { createServiceClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

type ThreadRow = {
  id: string;
  customer_user_id: string;
  status: "open" | "resolved";
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
    .from("chat_threads")
    .select("id, customer_user_id, status, updated_at")
    .eq("id", id)
    .single();

  if (threadError || !thread) {
    return NextResponse.json({ error: threadError?.message ?? "Conversation not found" }, { status: 404 });
  }

  const typedThread = thread as ThreadRow;

  await supabase
    .from("chat_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("thread_id", id)
    .eq("sender_role", "customer")
    .is("read_at", null);

  const [{ data: profile }, { data: messages, error: messagesError }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone").eq("id", typedThread.customer_user_id).maybeSingle(),
    supabase
      .from("chat_messages")
      .select("id, thread_id, sender_role, body, created_at")
      .eq("thread_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }

  const typedProfile = (profile as ProfileRow | null) ?? null;
  const payload = {
    id: typedThread.id,
    customer: {
      id: typedThread.customer_user_id,
      name: typedProfile?.full_name ?? "Customer",
      phone: typedProfile?.phone ?? "",
    },
    status: typedThread.status,
    unreadCount: 0,
    messages: ((messages ?? []) as MessageRow[]).map((message) => ({
      id: message.id,
      role: message.sender_role === "customer" ? "customer" : "admin",
      content: message.body,
      timestamp: formatTimestamp(message.created_at),
    })),
    updatedAt: typedThread.updated_at,
  };

  return NextResponse.json({ conversation: payload });
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
    .from("chat_messages")
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
    .from("chat_threads")
    .update({ status: "open", updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({
    message: {
      id: inserted.id,
      role: inserted.sender_role === "customer" ? "customer" : "admin",
      content: inserted.body,
      timestamp: formatTimestamp(inserted.created_at),
    },
  });
}

type PatchPayload = {
  status?: "open" | "resolved";
};

export async function PATCH(req: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as PatchPayload;

  if (!body.status || !["open", "resolved"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("chat_threads")
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
