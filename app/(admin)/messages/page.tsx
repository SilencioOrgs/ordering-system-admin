"use client";

import { ChevronLeft, Search, SendHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminAvatar } from "@/components/shared/AdminAvatar";
import { useToast } from "@/components/shared/Toast";
import type { Conversation, Message } from "@/lib/types";

const quickReplies = [
  "Your order is being prepared!",
  "We'll get back to you shortly.",
  "Thank you for your patience!",
];

type ConversationListResponse = {
  conversations?: Conversation[];
  error?: string;
};

type ConversationDetailResponse = {
  conversation?: Conversation;
  message?: Message;
  ok?: boolean;
  error?: string;
};

export default function MessagesPage() {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "unread" | "resolved">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;

  const fetchConversations = useCallback(async () => {
    const response = await fetch("/api/admin/messages");
    const body = (await response.json()) as ConversationListResponse;

    if (!response.ok) {
      throw new Error(body.error ?? "Failed to load conversations");
    }

    const nextConversations = body.conversations ?? [];
    setConversations((previous) => {
      const previousMap = new Map(previous.map((conversation) => [conversation.id, conversation]));
      return nextConversations.map((conversation) => {
        const existing = previousMap.get(conversation.id);
        if (existing && selectedId === conversation.id && existing.messages.length > conversation.messages.length) {
          return { ...conversation, messages: existing.messages };
        }
        return conversation;
      });
    });
    setLoading(false);
  }, [selectedId]);

  const fetchConversationDetail = useCallback(async (conversationId: string) => {
    const response = await fetch(`/api/admin/messages/${conversationId}`);
    const body = (await response.json()) as ConversationDetailResponse;

    if (!response.ok || !body.conversation) {
      throw new Error(body.error ?? "Failed to load conversation");
    }

    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === conversationId ? body.conversation as Conversation : conversation
      )
    );
  }, []);

  useEffect(() => {
    void fetchConversations().catch((error: unknown) => {
      setLoading(false);
      toast({
        type: "error",
        title: "Load failed",
        message: error instanceof Error ? error.message : "Failed to load conversations",
      });
    });
  }, [fetchConversations, toast]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchConversations().catch(() => undefined);
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchConversations]);

  useEffect(() => {
    if (!selectedId) return;

    void fetchConversationDetail(selectedId).catch(() => undefined);
    const interval = window.setInterval(() => {
      void fetchConversationDetail(selectedId).catch(() => undefined);
    }, 2500);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchConversationDetail, selectedId]);

  const list = useMemo(
    () =>
      conversations.filter((conversation) => {
        const hit = conversation.customer.name.toLowerCase().includes(query.toLowerCase());
        if (tab === "unread") return hit && conversation.unreadCount > 0;
        if (tab === "resolved") return hit && conversation.status === "resolved";
        return hit;
      }),
    [conversations, query, tab]
  );

  const send = async () => {
    const text = draft.trim();
    if (!selected || !text) return;

    setSending(true);
    try {
      const response = await fetch(`/api/admin/messages/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const body = (await response.json()) as ConversationDetailResponse;
      if (!response.ok || !body.message) {
        throw new Error(body.error ?? "Failed to send message");
      }

      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === selected.id
            ? {
                ...conversation,
                status: "open",
                messages: [...conversation.messages, body.message as Message],
              }
            : conversation
        )
      );
      setDraft("");
      void fetchConversations();
    } catch (error) {
      toast({
        type: "error",
        title: "Send failed",
        message: error instanceof Error ? error.message : "Failed to send message",
      });
    } finally {
      setSending(false);
    }
  };

  const markResolved = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/admin/messages/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
      const body = (await response.json()) as ConversationDetailResponse;
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to mark as resolved");
      }

      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, status: "resolved", unreadCount: 0 }
            : conversation
        )
      );
      toast({ type: "success", title: "Marked resolved" });
    } catch (error) {
      toast({
        type: "error",
        title: "Update failed",
        message: error instanceof Error ? error.message : "Failed to mark as resolved",
      });
    }
  };

  const isMobileChat = Boolean(selected);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm lg:flex lg:h-[calc(100vh-11rem)]">
      <aside className={`${isMobileChat ? "hidden" : "block"} w-full border-r border-slate-100 lg:block lg:w-80`}>
        <div className="border-b border-slate-100 p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search conversation"
              className="h-11 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-[16px]"
            />
          </label>
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 text-xs">
            {([
              ["all", "All"],
              ["unread", "Unread"],
              ["resolved", "Resolved"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`min-h-11 rounded-md px-2 ${tab === value ? "bg-white text-slate-900" : "text-slate-500"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[calc(100vh-15rem)] overflow-y-auto lg:max-h-none lg:h-full">
          {loading ? (
            <div className="p-4 text-sm text-slate-400">Loading conversations...</div>
          ) : list.length === 0 ? (
            <div className="p-4 text-sm text-slate-400">No conversations yet.</div>
          ) : (
            list.map((conversation) => {
              const last = conversation.messages[conversation.messages.length - 1];
              return (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedId(conversation.id)}
                  className={`flex min-h-11 w-full items-center gap-2 border-b border-slate-50 p-3 text-left hover:bg-slate-50 active:scale-95 ${conversation.unreadCount > 0 ? "bg-emerald-50/60" : ""}`}
                >
                  <AdminAvatar name={conversation.customer.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{conversation.customer.name}</p>
                      <span className="ml-auto flex-none text-[10px] text-slate-400">{last?.timestamp ?? "-"}</span>
                    </div>
                    <p className="truncate text-xs text-slate-500">{last?.content ?? "No messages yet"}</p>
                  </div>
                  {conversation.unreadCount > 0 ? (
                    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] text-white">
                      {conversation.unreadCount}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className={`${isMobileChat ? "flex" : "hidden"} h-[calc(100vh-11rem)] flex-1 flex-col lg:flex`}>
        {selected ? (
          <>
            <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-slate-100 bg-white px-3">
              <button
                aria-label="Back to conversation list"
                onClick={() => setSelectedId(null)}
                className="min-h-11 min-w-11 rounded-lg p-2 lg:hidden"
              >
                <ChevronLeft className="h-5 w-5 text-slate-600" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{selected.customer.name}</p>
                <p className="truncate text-xs text-slate-500">{selected.customer.phone}</p>
              </div>
              <button
                onClick={() => void markResolved(selected.id)}
                className="min-h-11 rounded-lg border border-slate-200 px-2 text-xs text-slate-700"
              >
                Mark Resolved
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-3 md:p-4">
              <div className="flex flex-col gap-3">
                {selected.messages.map((message) => (
                  <div key={message.id} className={`max-w-[75%] ${message.role === "admin" ? "self-end" : "self-start"}`}>
                    <div
                      className={`${message.role === "admin" ? "rounded-2xl rounded-tr-sm bg-emerald-700 text-white" : "rounded-2xl rounded-tl-sm bg-slate-100 text-slate-900"} px-3 py-2 text-sm`}
                    >
                      {message.content}
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-400">{message.timestamp}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-50 px-3 py-2">
              <div className="flex flex-wrap gap-2">
                {quickReplies.map((reply) => (
                  <button
                    key={reply}
                    onClick={() => setDraft(reply)}
                    className="min-h-11 rounded-full bg-slate-100 px-3 py-1.5 text-xs hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-100 p-3 md:p-4">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void send();
                  }
                }}
                placeholder="Type a message"
                className="h-11 flex-1 rounded-full border border-slate-200 px-4 text-[16px] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <button
                aria-label="Send message"
                onClick={() => void send()}
                disabled={sending || !draft.trim()}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-700 text-white hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <SendHorizontal className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="grid h-full place-items-center p-6 text-center">
            <div>
              <MessageSquarePlaceholder />
              <p className="mt-3 text-base font-semibold text-slate-500">Select a conversation</p>
              <p className="mt-1 text-sm text-slate-400">Start replying to customer messages.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function MessageSquarePlaceholder() {
  return <div className="mx-auto h-12 w-12 rounded-xl bg-slate-100" />;
}
