"use client";

import { ChevronDown, ChevronLeft, ChevronUp, Search, SendHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminAvatar } from "@/components/shared/AdminAvatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/components/shared/Toast";

type CustomOrderStatus = "Pending Review" | "Quoted" | "Confirmed" | "Rejected";
type QuoteStatus = "Sent" | "Accepted" | "Declined" | "Superseded";

interface CustomOrderMessage {
  id: string;
  role: "customer" | "admin";
  content: string;
  timestamp: string;
  createdAt: string;
}

interface CustomOrderQuote {
  id: string;
  title: string;
  itemDescription: string;
  quantity: number;
  unitPrice: number;
  quotedTotal: number;
  deliveryDate: string | null;
  notes: string | null;
  status: QuoteStatus;
  createdAt: string;
}

interface CustomOrderRequest {
  id: string;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  status: CustomOrderStatus;
  unreadCount: number;
  updatedAt: string;
  acceptedQuoteId?: string | null;
  lastMessage?: {
    id: string;
    role: "customer" | "admin";
    content: string;
    timestamp: string;
  } | null;
  latestQuote?: CustomOrderQuote | null;
  messages: CustomOrderMessage[];
  quotes: CustomOrderQuote[];
}

type ListResponse = {
  requests?: Array<Omit<CustomOrderRequest, "messages" | "quotes">>;
  error?: string;
};

type DetailResponse = {
  request?: CustomOrderRequest;
  message?: CustomOrderMessage;
  quote?: CustomOrderQuote;
  ok?: boolean;
  error?: string;
};

function formatPeso(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function CustomOrdersPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<CustomOrderRequest[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendingQuote, setSendingQuote] = useState(false);
  const [openQuoteForm, setOpenQuoteForm] = useState(true);

  const [quoteTitle, setQuoteTitle] = useState("Custom Order Quote");
  const [quoteDescription, setQuoteDescription] = useState("");
  const [quoteQuantity, setQuoteQuantity] = useState("1");
  const [quoteUnitPrice, setQuoteUnitPrice] = useState("");
  const [quoteDeliveryDate, setQuoteDeliveryDate] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");

  const selected = requests.find((request) => request.id === selectedId) ?? null;

  const fetchRequests = useCallback(async () => {
    const response = await fetch("/api/admin/custom-orders");
    const body = (await response.json()) as ListResponse;

    if (!response.ok) {
      throw new Error(body.error ?? "Failed to load custom order requests");
    }

    const baseRequests = body.requests ?? [];

    setRequests((previous) => {
      const previousById = new Map(previous.map((request) => [request.id, request]));
      return baseRequests.map((request) => {
        const existing = previousById.get(request.id);
        return {
          ...request,
          messages: existing?.messages ?? [],
          quotes: existing?.quotes ?? [],
        };
      });
    });

    setLoading(false);
  }, []);

  const fetchRequestDetail = useCallback(async (requestId: string) => {
    const response = await fetch(`/api/admin/custom-orders/${requestId}`);
    const body = (await response.json()) as DetailResponse;
    const requestDetail = body.request;

    if (!response.ok || !requestDetail) {
      throw new Error(body.error ?? "Failed to load request details");
    }

    const lastMessage = requestDetail.messages[requestDetail.messages.length - 1] ?? null;

    setRequests((previous) =>
      previous.map((request) =>
        request.id === requestId
          ? {
              ...request,
              ...requestDetail,
              unreadCount: 0,
              lastMessage: lastMessage
                ? {
                    id: lastMessage.id,
                    role: lastMessage.role,
                    content: lastMessage.content,
                    timestamp: lastMessage.timestamp,
                  }
                : null,
              latestQuote: requestDetail.quotes[0] ?? null,
            }
          : request
      )
    );
  }, []);

  useEffect(() => {
    void fetchRequests().catch((error: unknown) => {
      setLoading(false);
      toast({
        type: "error",
        title: "Load failed",
        message: error instanceof Error ? error.message : "Failed to load custom orders",
      });
    });
  }, [fetchRequests, toast]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchRequests().catch(() => undefined);
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchRequests]);

  useEffect(() => {
    if (!selectedId) return;

    void fetchRequestDetail(selectedId).catch(() => undefined);
    const interval = window.setInterval(() => {
      void fetchRequestDetail(selectedId).catch(() => undefined);
    }, 2500);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchRequestDetail, selectedId]);

  const list = useMemo(() => {
    const needle = query.toLowerCase();
    return requests.filter((request) => request.customer.name.toLowerCase().includes(needle));
  }, [requests, query]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!selected || !text) return;

    setSending(true);
    try {
      const response = await fetch(`/api/admin/custom-orders/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const body = (await response.json()) as DetailResponse;
      const newMessage = body.message;

      if (!response.ok || !newMessage) {
        throw new Error(body.error ?? "Failed to send message");
      }

      setRequests((previous) =>
        previous.map((request) =>
          request.id === selected.id
            ? {
                ...request,
                status: request.status,
                messages: [...request.messages, newMessage],
                lastMessage: {
                  id: newMessage.id,
                  role: newMessage.role,
                  content: newMessage.content,
                  timestamp: newMessage.timestamp,
                },
              }
            : request
        )
      );

      setDraft("");
      void fetchRequests();
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

  const sendQuotation = async () => {
    if (!selected) return;

    setSendingQuote(true);
    try {
      const response = await fetch(`/api/admin/custom-orders/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote: {
            title: quoteTitle,
            itemDescription: quoteDescription,
            quantity: Number(quoteQuantity),
            unitPrice: Number(quoteUnitPrice),
            deliveryDate: quoteDeliveryDate || null,
            notes: quoteNotes || null,
          },
        }),
      });
      const body = (await response.json()) as DetailResponse;
      const createdQuote = body.quote;

      if (!response.ok || !createdQuote) {
        throw new Error(body.error ?? "Failed to send quotation");
      }

      setRequests((previous) =>
        previous.map((request) =>
          request.id === selected.id
            ? {
                ...request,
                status: "Quoted",
                latestQuote: createdQuote,
                quotes: [createdQuote, ...request.quotes],
              }
            : request
        )
      );

      toast({ type: "success", title: "Quotation sent" });
      setQuoteDescription("");
      setQuoteQuantity("1");
      setQuoteUnitPrice("");
      setQuoteDeliveryDate("");
      setQuoteNotes("");
      void fetchRequests();
    } catch (error) {
      toast({
        type: "error",
        title: "Quotation failed",
        message: error instanceof Error ? error.message : "Failed to send quotation",
      });
    } finally {
      setSendingQuote(false);
    }
  };

  const updateStatus = async (status: CustomOrderStatus) => {
    if (!selected) return;

    try {
      const response = await fetch(`/api/admin/custom-orders/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await response.json()) as DetailResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to update status");
      }

      setRequests((previous) =>
        previous.map((request) =>
          request.id === selected.id
            ? {
                ...request,
                status,
              }
            : request
        )
      );

      toast({ type: "success", title: "Status updated", message: status });
    } catch (error) {
      toast({
        type: "error",
        title: "Update failed",
        message: error instanceof Error ? error.message : "Failed to update status",
      });
    }
  };

  const isMobileDetail = Boolean(selected);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm lg:flex lg:h-[calc(100vh-11rem)]">
      <aside className={`${isMobileDetail ? "hidden" : "block"} w-full border-r border-slate-100 lg:block lg:w-80`}>
        <div className="border-b border-slate-100 p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search request"
              className="h-11 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-[16px]"
            />
          </label>
        </div>

        <div className="max-h-[calc(100vh-15rem)] overflow-y-auto lg:max-h-none lg:h-full">
          {loading ? (
            <div className="p-4 text-sm text-slate-400">Loading requests...</div>
          ) : list.length === 0 ? (
            <div className="p-4 text-sm text-slate-400">No custom order requests yet.</div>
          ) : (
            list.map((request) => (
              <button
                key={request.id}
                onClick={() => setSelectedId(request.id)}
                className={`flex min-h-11 w-full items-center gap-2 border-b border-slate-50 p-3 text-left hover:bg-slate-50 active:scale-95 ${request.unreadCount > 0 ? "bg-emerald-50/60" : ""}`}
              >
                <AdminAvatar name={request.customer.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{request.customer.name}</p>
                    <span className="ml-auto text-[10px] text-slate-400">{request.lastMessage?.timestamp ?? "-"}</span>
                  </div>
                  <p className="truncate text-xs text-slate-500">{request.lastMessage?.content ?? request.latestQuote?.itemDescription ?? "No messages yet"}</p>
                </div>
                {request.unreadCount > 0 ? (
                  <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] text-white">
                    {request.unreadCount}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </aside>

      <section className={`${isMobileDetail ? "flex" : "hidden"} h-[calc(100vh-11rem)] flex-1 flex-col lg:flex`}>
        {selected ? (
          <>
            <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-slate-100 bg-white px-3">
              <button
                aria-label="Back to request list"
                onClick={() => setSelectedId(null)}
                className="min-h-11 min-w-11 rounded-lg p-2 lg:hidden"
              >
                <ChevronLeft className="h-5 w-5 text-slate-600" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{selected.customer.name}</p>
                <p className="truncate text-xs text-slate-500">{selected.customer.phone}</p>
              </div>
              <div className="w-36">
                <select
                  value={selected.status}
                  onChange={(event) => void updateStatus(event.target.value as CustomOrderStatus)}
                  className="h-10 w-full rounded-lg border border-slate-200 px-2 text-xs"
                >
                  <option>Pending Review</option>
                  <option>Quoted</option>
                  <option>Confirmed</option>
                  <option>Rejected</option>
                </select>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-3 md:p-4">
              <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Status</p>
                <StatusBadge status={selected.status} />
              </div>

              {selected.quotes.length > 0 && (
                <div className="mb-4 space-y-3">
                  {selected.quotes.map((quote) => (
                    <div key={quote.id} className="rounded-xl border border-emerald-100 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900">{quote.title}</p>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${quote.status === "Accepted" ? "bg-emerald-100 text-emerald-700" : quote.status === "Sent" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                          {quote.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">{quote.itemDescription}</p>
                      <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-600">
                        <p>Qty: <span className="font-semibold text-slate-900">{quote.quantity}</span></p>
                        <p>Unit: <span className="font-semibold text-slate-900">{formatPeso(quote.unitPrice)}</span></p>
                        <p className="col-span-2">Total: <span className="font-bold text-emerald-700">{formatPeso(quote.quotedTotal)}</span></p>
                        {quote.deliveryDate && <p className="col-span-2">Target date: <span className="font-semibold text-slate-900">{quote.deliveryDate}</span></p>}
                      </div>
                      {quote.notes && <p className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-600">{quote.notes}</p>}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-3">
                {selected.messages.length === 0 ? (
                  <div className="text-center text-sm text-slate-400">No messages yet.</div>
                ) : (
                  selected.messages.map((message) => (
                    <div key={message.id} className={`max-w-[75%] ${message.role === "admin" ? "self-end" : "self-start"}`}>
                      <div
                        className={`${message.role === "admin" ? "rounded-2xl rounded-tr-sm bg-emerald-700 text-white" : "rounded-2xl rounded-tl-sm bg-slate-100 text-slate-900"} px-3 py-2 text-sm`}
                      >
                        {message.content}
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-400">{message.timestamp}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-5 rounded-xl border border-slate-100 bg-white">
                <button
                  onClick={() => setOpenQuoteForm((prev) => !prev)}
                  className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-left"
                >
                  <span className="text-sm font-semibold text-slate-800">Create Quotation Card</span>
                  {openQuoteForm ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                </button>
                {openQuoteForm && (
                  <div className="border-t border-slate-100 p-3">
                    <div className="space-y-3">
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-600">Title</span>
                        <input
                          value={quoteTitle}
                          onChange={(event) => setQuoteTitle(event.target.value)}
                          className="h-11 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-600">Item Description</span>
                        <textarea
                          value={quoteDescription}
                          onChange={(event) => setQuoteDescription(event.target.value)}
                          className="min-h-20 w-full rounded-lg border border-slate-200 p-3 text-[16px]"
                        />
                      </label>

                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-600">Quantity</span>
                          <input
                            type="number"
                            min={1}
                            value={quoteQuantity}
                            onChange={(event) => setQuoteQuantity(event.target.value)}
                            className="h-11 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold text-slate-600">Unit Price (PHP)</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={quoteUnitPrice}
                            onChange={(event) => setQuoteUnitPrice(event.target.value)}
                            className="h-11 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
                          />
                        </label>
                      </div>

                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-600">Delivery Date</span>
                        <input
                          type="date"
                          value={quoteDeliveryDate}
                          onChange={(event) => setQuoteDeliveryDate(event.target.value)}
                          className="h-11 w-full rounded-lg border border-slate-200 px-3 text-[16px]"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-600">Notes</span>
                        <textarea
                          value={quoteNotes}
                          onChange={(event) => setQuoteNotes(event.target.value)}
                          className="min-h-16 w-full rounded-lg border border-slate-200 p-3 text-[16px]"
                        />
                      </label>

                      <button
                        onClick={() => void sendQuotation()}
                        disabled={sendingQuote}
                        className="min-h-11 w-full rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {sendingQuote ? "Sending quotation..." : "Send Quotation"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-100 p-3 md:p-4">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void sendMessage();
                  }
                }}
                placeholder="Type a message"
                className="h-11 flex-1 rounded-full border border-slate-200 px-4 text-[16px] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <button
                aria-label="Send message"
                onClick={() => void sendMessage()}
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
              <div className="mx-auto h-12 w-12 rounded-xl bg-slate-100" />
              <p className="mt-3 text-base font-semibold text-slate-500">Select a custom request</p>
              <p className="mt-1 text-sm text-slate-400">Review details, send quotation cards, and message the customer.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

