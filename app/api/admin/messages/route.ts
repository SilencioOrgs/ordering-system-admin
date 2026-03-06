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
  const threadsByCustomer = new Map<string, ThreadRow[]>();

  for (const message of (messages ?? []) as MessageRow[]) {
    const existing = messagesByThread.get(message.thread_id) ?? [];
    existing.push(message);
    messagesByThread.set(message.thread_id, existing);
  }

  for (const thread of typedThreads) {
    const existing = threadsByCustomer.get(thread.customer_user_id) ?? [];
    existing.push(thread);
    threadsByCustomer.set(thread.customer_user_id, existing);
  }

  const payload = Array.from(threadsByCustomer.entries())
    .map(([customerId, customerThreads]) => {
      const profile = profileById.get(customerId);

      let primaryThread = customerThreads[0];
      let latestMessage: MessageRow | null = null;
      let unreadCount = 0;
      let hasOpenThread = false;
      let latestActivityAt = new Date(primaryThread.updated_at).getTime();

      for (const thread of customerThreads) {
        if (thread.status === "open") hasOpenThread = true;

        const threadMessages = messagesByThread.get(thread.id) ?? [];
        unreadCount += threadMessages.filter(
          (message) => message.sender_role === "customer" && message.read_at === null
        ).length;

        const threadLatestMessage = threadMessages[0] ?? null;
        if (
          threadLatestMessage &&
          (!latestMessage || +new Date(threadLatestMessage.created_at) > +new Date(latestMessage.created_at))
        ) {
          latestMessage = threadLatestMessage;
        }

        const threadActivityAt = threadLatestMessage
          ? +new Date(threadLatestMessage.created_at)
          : +new Date(thread.updated_at);

        if (threadActivityAt > latestActivityAt) {
          latestActivityAt = threadActivityAt;
          primaryThread = thread;
        }
      }

      if (latestMessage) {
        const threadWithLatestMessage = customerThreads.find((thread) => thread.id === latestMessage?.thread_id);
        if (threadWithLatestMessage) {
          primaryThread = threadWithLatestMessage;
          latestActivityAt = +new Date(latestMessage.created_at);
        }
      }

      return {
        id: primaryThread.id,
        customer: {
          id: customerId,
          name: profile?.full_name ?? "Customer",
          phone: profile?.phone ?? "",
        },
        status: hasOpenThread ? "open" : "resolved",
        unreadCount,
        messages: latestMessage
          ? [
              {
                id: latestMessage.id,
                role: latestMessage.sender_role === "customer" ? "customer" : "admin",
                content: latestMessage.body,
                timestamp: formatTimestamp(latestMessage.created_at),
              },
            ]
          : [],
        updatedAt: new Date(latestActivityAt).toISOString(),
      };
    })
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));

  return NextResponse.json({ conversations: payload });
}
