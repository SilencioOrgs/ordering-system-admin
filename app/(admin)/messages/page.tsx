"use client";

import { ChevronLeft, Search, SendHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminAvatar } from "@/components/shared/AdminAvatar";
import { useToast } from "@/components/shared/Toast";
import type { Conversation, Message } from "@/lib/types";

const quickReplies = [
  "Your order is being prepared!",
  "We'll get back to you shortly.",
  "Thank you for your patience!",
];

export default function MessagesPage() {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "unread" | "resolved">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const list = useMemo(() => conversations.filter((c) => {
    const hit = c.customer.name.toLowerCase().includes(query.toLowerCase());
    if (tab === "unread") return hit && c.unreadCount > 0;
    if (tab === "resolved") return hit && c.status === "resolved";
    return hit;
  }), [conversations, query, tab]);

  const send = () => {
    const text = draft.trim();
    if (!selected || !text) return;
    const msg: Message = { id: `m-${Date.now()}`, role: "admin", content: text, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    setConversations((prev) => prev.map((c) => c.id === selected.id ? { ...c, unreadCount: 0, messages: [...c.messages, msg] } : c));
    setDraft("");
  };

  const isMobileChat = !!selected;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm lg:flex lg:h-[calc(100vh-11rem)]">
      <aside className={`${isMobileChat ? "hidden" : "block"} w-full border-r border-slate-100 lg:block lg:w-80`}>
        <div className="border-b border-slate-100 p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversation" className="h-11 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-[16px]" />
          </label>
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 text-xs">
            {([
              ["all", "All"],
              ["unread", "Unread"],
              ["resolved", "Resolved"],
            ] as const).map(([value, label]) => (
              <button key={value} onClick={() => setTab(value)} className={`min-h-11 rounded-md px-2 ${tab === value ? "bg-white text-slate-900" : "text-slate-500"}`}>{label}</button>
            ))}
          </div>
        </div>

        <div className="max-h-[calc(100vh-15rem)] overflow-y-auto lg:max-h-none lg:h-full">
          {list.map((c) => {
            const last = c.messages[c.messages.length - 1];
            if (!last) return null;
            return (
              <button key={c.id} onClick={() => setSelectedId(c.id)} className={`flex min-h-11 w-full items-center gap-2 border-b border-slate-50 p-3 text-left hover:bg-slate-50 active:scale-95 ${c.unreadCount > 0 ? "bg-emerald-50/60" : ""}`}>
                <AdminAvatar name={c.customer.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{c.customer.name}</p>
                    <span className="ml-auto flex-none text-[10px] text-slate-400">{last.timestamp}</span>
                  </div>
                  <p className="truncate text-xs text-slate-500">{last.content}</p>
                </div>
                {c.unreadCount > 0 ? <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] text-white">{c.unreadCount}</span> : null}
              </button>
            );
          })}
        </div>
      </aside>

      <section className={`${isMobileChat ? "flex" : "hidden"} h-[calc(100vh-11rem)] flex-1 flex-col lg:flex`}>
        {selected ? (
          <>
            <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-slate-100 bg-white px-3">
              <button aria-label="Back to conversation list" onClick={() => setSelectedId(null)} className="min-h-11 min-w-11 rounded-lg p-2 lg:hidden">
                <ChevronLeft className="h-5 w-5 text-slate-600" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{selected.customer.name}</p>
                <p className="truncate text-xs text-slate-500">{selected.customer.phone}</p>
              </div>
              <button onClick={() => {
                setConversations((prev) => prev.map((c) => c.id === selected.id ? { ...c, status: "resolved", unreadCount: 0 } : c));
                toast({ type: "success", title: "Marked resolved" });
              }} className="min-h-11 rounded-lg border border-slate-200 px-2 text-xs text-slate-700">Mark Resolved</button>
            </header>

            <div className="flex-1 overflow-y-auto p-3 md:p-4">
              <div className="flex flex-col gap-3">
                {selected.messages.map((m) => (
                  <div key={m.id} className={`max-w-[75%] ${m.role === "admin" ? "self-end" : "self-start"}`}>
                    <div className={`${m.role === "admin" ? "rounded-2xl rounded-tr-sm bg-emerald-700 text-white" : "rounded-2xl rounded-tl-sm bg-slate-100 text-slate-900"} px-3 py-2 text-sm`}>
                      {m.content}
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-400">{m.timestamp}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-50 px-3 py-2">
              <div className="flex flex-wrap gap-2">
                {quickReplies.map((reply) => (
                  <button key={reply} onClick={() => setDraft(reply)} className="min-h-11 rounded-full bg-slate-100 px-3 py-1.5 text-xs hover:bg-emerald-50 hover:text-emerald-700">{reply}</button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-100 p-3 md:p-4">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="Type a message" className="h-11 flex-1 rounded-full border border-slate-200 px-4 text-[16px] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              <button aria-label="Send message" onClick={send} className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-700 text-white hover:bg-emerald-600 active:scale-95">
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
