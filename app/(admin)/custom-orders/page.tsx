"use client";

import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminAvatar } from "@/components/shared/AdminAvatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/components/shared/Toast";
import { customOrderRequests as seed } from "@/lib/mockData";
import type { CustomOrderRequest, CustomOrderStatus } from "@/lib/types";

export default function CustomOrdersPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<CustomOrderRequest[]>(seed);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [agreedPrice, setAgreedPrice] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");

  const list = useMemo(() => requests.filter((r) => r.customer.name.toLowerCase().includes(query.toLowerCase())), [requests, query]);
  const selected = requests.find((r) => r.id === selectedId) ?? null;

  const statusUpdate = (status: CustomOrderStatus) => {
    if (!selected) return;
    setRequests((prev) => prev.map((r) => (r.id === selected.id ? { ...r, status } : r)));
    toast({ type: "success", title: "Request updated", message: `Status: ${status}` });
  };

  const convert = () => {
    if (!description.trim() || Number(quantity) < 1 || Number(agreedPrice) <= 0 || !deliveryDate) {
      toast({ type: "error", title: "Missing fields", message: "Complete all required fields first." });
      return;
    }
    toast({ type: "success", title: "Order created", message: "Custom request converted to order." });
  };

  const showChatOnMobile = !!selected;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm lg:flex lg:h-[calc(100vh-11rem)]">
      <aside className={`${showChatOnMobile ? "hidden" : "block"} w-full border-r border-slate-100 lg:block lg:w-80`}>
        <div className="border-b border-slate-100 p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search request" className="h-11 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-[16px]" />
          </label>
        </div>
        <div className="max-h-[calc(100vh-15rem)] overflow-y-auto lg:max-h-none lg:h-full">
          {list.map((r) => (
            <button key={r.id} onClick={() => setSelectedId(r.id)} className="flex min-h-11 w-full items-center gap-2 border-b border-slate-50 p-3 text-left hover:bg-slate-50 active:scale-95">
              <AdminAvatar name={r.customer.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.customer.name}</p>
                <p className="truncate text-xs text-slate-500">{r.customer.phone}</p>
              </div>
              <StatusBadge status={r.status} size="sm" />
            </button>
          ))}
        </div>
      </aside>

      <section className={`${showChatOnMobile ? "block" : "hidden"} flex-1 lg:block`}>
        {selected ? (
          <div className="flex h-[calc(100vh-11rem)] flex-col">
            <header className="border-b border-slate-100 px-3 py-3">
              <p className="text-sm font-semibold">{selected.customer.name}</p>
              <p className="text-xs text-slate-500">{selected.customer.phone}</p>
            </header>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="space-y-3">
                {selected.messages.map((m) => (
                  <div key={m.id} className={`max-w-[75%] ${m.role === "admin" ? "ml-auto" : ""}`}>
                    <div className={`${m.role === "admin" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-900"} rounded-2xl px-3 py-2 text-sm`}>
                      {m.content}
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-400">{m.timestamp}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-slate-100">
                <button className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-left" onClick={() => setOpenForm((v) => !v)}>
                  <span className="text-sm font-semibold">Convert to Order</span>
                  {openForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <div className={`${openForm ? "block" : "hidden"} border-t border-slate-100 p-3 lg:block`}>
                  <FormBlock
                    description={description}
                    setDescription={setDescription}
                    quantity={quantity}
                    setQuantity={setQuantity}
                    agreedPrice={agreedPrice}
                    setAgreedPrice={setAgreedPrice}
                    deliveryDate={deliveryDate}
                    setDeliveryDate={setDeliveryDate}
                    notes={notes}
                    setNotes={setNotes}
                    convert={convert}
                  />
                </div>
              </div>
            </div>
            <div className="border-t border-slate-100 p-3">
              <select onChange={(e) => statusUpdate(e.target.value as CustomOrderStatus)} defaultValue={selected.status} className="h-11 w-full rounded-lg border border-slate-200 px-3 text-[16px]">
                <option>Pending Review</option>
                <option>Quoted</option>
                <option>Confirmed</option>
                <option>Rejected</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="grid h-[60vh] place-items-center p-6 text-center">
            <div>
              <div className="mx-auto h-12 w-12 rounded-xl bg-slate-100" />
              <p className="mt-3 text-base font-semibold text-slate-500">Select a custom request</p>
              <p className="mt-1 text-sm text-slate-400">Open a thread to quote and convert to an order.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function FormBlock(props: {
  description: string;
  setDescription: (v: string) => void;
  quantity: string;
  setQuantity: (v: string) => void;
  agreedPrice: string;
  setAgreedPrice: (v: string) => void;
  deliveryDate: string;
  setDeliveryDate: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  convert: () => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Item description</span><textarea value={props.description} onChange={(e) => props.setDescription(e.target.value)} className="min-h-20 w-full rounded-lg border border-slate-200 p-3 text-[16px]" /></label>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Quantity</span><input type="number" min={1} value={props.quantity} onChange={(e) => props.setQuantity(e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 px-3 text-[16px]" /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Agreed Price (PHP)</span><input type="number" min={1} value={props.agreedPrice} onChange={(e) => props.setAgreedPrice(e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 px-3 text-[16px]" /></label>
      </div>
      <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Delivery Date</span><input type="date" value={props.deliveryDate} onChange={(e) => props.setDeliveryDate(e.target.value)} className="h-11 w-full rounded-lg border border-slate-200 px-3 text-[16px]" /></label>
      <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Notes</span><textarea value={props.notes} onChange={(e) => props.setNotes(e.target.value)} className="min-h-20 w-full rounded-lg border border-slate-200 p-3 text-[16px]" /></label>
      <button onClick={props.convert} className="min-h-11 w-full rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800">Create Order</button>
    </div>
  );
}
