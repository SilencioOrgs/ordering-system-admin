import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/adminAuth";
import { createServiceClient } from "@/lib/supabase/server";

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
  read_at: string | null;
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
    .from("chat_threads")
    .select("id, customer_user_id, status, updated_at")
    .order("updated_at", { ascending: false });

  if (threadsError) {
    return NextResponse.json({ error: threadsError.message }, { status: 500 });
  }

  const typedThreads = (threads ?? []) as ThreadRow[];
  if (typedThreads.length === 0) {
    return NextResponse.json({ conversations: [] });
  }

  const threadIds = typedThreads.map((thread) => thread.id);
  const customerIds = Array.from(new Set(typedThreads.map((thread) => thread.customer_user_id)));

  const [{ data: profiles, error: profilesError }, { data: messages, error: messagesError }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone").in("id", customerIds),
    supabase
      .from("chat_messages")
      .select("id, thread_id, sender_role, body, created_at, read_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false }),
  ]);

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }

  const profileById = new Map<string, ProfileRow>((profiles ?? []).map((profile) => [profile.id, profile as ProfileRow]));
  const messagesByThread = new Map<string, MessageRow[]>();

  for (const message of (messages ?? []) as MessageRow[]) {
    const existing = messagesByThread.get(message.thread_id) ?? [];
    existing.push(message);
    messagesByThread.set(message.thread_id, existing);
  }

  const payload = typedThreads.map((thread) => {
    const profile = profileById.get(thread.customer_user_id);
    const threadMessages = messagesByThread.get(thread.id) ?? [];
    const latest = threadMessages[0] ?? null;
    const unreadCount = threadMessages.filter(
      (message) => message.sender_role === "customer" && message.read_at === null
    ).length;

    return {
      id: thread.id,
      customer: {
        id: thread.customer_user_id,
        name: profile?.full_name ?? "Customer",
        phone: profile?.phone ?? "",
      },
      status: thread.status,
      unreadCount,
      messages: latest
        ? [
            {
              id: latest.id,
              role: latest.sender_role === "customer" ? "customer" : "admin",
              content: latest.body,
              timestamp: formatTimestamp(latest.created_at),
            },
          ]
        : [],
      updatedAt: thread.updated_at,
    };
  });

  return NextResponse.json({ conversations: payload });
}
