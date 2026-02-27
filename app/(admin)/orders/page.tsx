"use client";

import { Eye, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { OrderTimeline } from "@/components/shared/OrderTimeline";
import { SlideOverDrawer } from "@/components/shared/SlideOverDrawer";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/components/shared/Toast";
import type { OrderStatus } from "@/lib/types";

type AdminOrderItem = {
  id: string;
  productId: string | null;
  name: string;
  qty: number;
  price: number;
  subtotal: number;
};

type AdminOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: "COD" | "GCash" | "Maya";
  deliveryMode: "Delivery" | "Pick-up";
  deliveryAddress: string | null;
  status: OrderStatus;
  createdAt: string;
  adminNote: string | null;
  total: number;
  items: AdminOrderItem[];
};

const statusOrder: Record<OrderStatus, number> = {
  Pending: 0,
  Preparing: 1,
  "Out for Delivery": 2,
  Delivered: 3,
  Cancelled: 4,
};

export default function OrdersPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | OrderStatus>("All");
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [nextStatus, setNextStatus] = useState<OrderStatus | "">("");
  const [note, setNote] = useState("");
  const [cancelTarget, setCancelTarget] = useState<AdminOrder | null>(null);

  useEffect(() => {
    void fetch("/api/admin/orders")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to load orders");
        return (body.orders ?? []) as AdminOrder[];
      })
      .then((items) => setOrders(items))
      .catch((e: unknown) => {
        toast({ type: "error", title: "Load failed", message: e instanceof Error ? e.message : "Failed to load orders" });
      });
  }, [toast]);

  const filtered = useMemo(
    () =>
      orders.filter((o) => {
        const hit =
          o.orderNumber.toLowerCase().includes(query.toLowerCase()) ||
          o.customerName.toLowerCase().includes(query.toLowerCase());
        const fit = filter === "All" ? true : o.status === filter;
        return hit && fit;
      }),
    [orders, query, filter]
  );

  const updateStatus = async (order: AdminOrder, target: OrderStatus) => {
    if (target === "Cancelled") {
      setCancelTarget(order);
      return;
    }

    if (statusOrder[target] < statusOrder[order.status]) {
      toast({ type: "error", title: "Invalid status", message: "Status cannot move backwards." });
      return;
    }

    const res = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: target }),
    });
    const body = await res.json();

    if (!res.ok) {
      toast({ type: "error", title: "Update failed", message: body.error ?? "Failed to update order" });
      return;
    }

    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: target } : o)));
    setSelected((prev) => (prev && prev.id === order.id ? { ...prev, status: target } : prev));
    toast({ type: "success", title: "Order updated", message: `${order.orderNumber} marked as ${target}.` });
  };

  const saveSelectedChanges = async () => {
    if (!selected || !nextStatus) {
      toast({ type: "warning", title: "Status required", message: "Please select a status first." });
      return;
    }

    if (nextStatus === "Cancelled") {
      setCancelTarget(selected);
      return;
    }

    if (statusOrder[nextStatus] < statusOrder[selected.status]) {
      toast({ type: "error", title: "Invalid status", message: "Status cannot move backwards." });
      return;
    }

    const res = await fetch(`/api/admin/orders/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus, adminNote: note }),
    });
    const body = await res.json();

    if (!res.ok) {
      toast({ type: "error", title: "Save failed", message: body.error ?? "Failed to save changes" });
      return;
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === selected.id ? { ...o, status: nextStatus, adminNote: note } : o
      )
    );
    setSelected((prev) =>
      prev && prev.id === selected.id ? { ...prev, status: nextStatus, adminNote: note } : prev
    );
    toast({ type: "success", title: "Changes saved", message: "Order note and status updated." });
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm md:p-4">
        <div className="grid gap-2 lg:grid-cols-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search order or customer"
              className="h-11 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-[16px] focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </label>
          <select value={filter} onChange={(e) => setFilter(e.target.value as "All" | OrderStatus)} className="h-11 rounded-lg border border-slate-200 px-3 text-[16px]">
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Preparing">Preparing</option>
            <option value="Out for Delivery">Out for Delivery</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <input type="text" placeholder="Date range" className="h-11 rounded-lg border border-slate-200 px-3 text-[16px]" />
        </div>
      </section>

      <section className="hidden overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Order ID</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3 max-lg:hidden">Payment</th>
              <th className="px-4 py-3 max-lg:hidden">Delivery</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{order.orderNumber}</td>
                <td className="px-4 py-3">{order.customerName}</td>
                <td className="px-4 py-3">{order.items.map((i) => `${i.qty}x ${i.name}`).join(", ")}</td>
                <td className="px-4 py-3">PHP {order.total.toLocaleString()}</td>
                <td className="px-4 py-3 max-lg:hidden">{order.paymentMethod}</td>
                <td className="px-4 py-3 max-lg:hidden">{order.deliveryMode}</td>
                <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      aria-label="View order details"
                      onClick={() => {
                        setSelected(order);
                        setNextStatus(order.status);
                        setNote(order.adminNote ?? "");
                      }}
                      className="min-h-11 rounded-lg border border-slate-200 px-3 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" /> View</span>
                    </button>
                    <select className="h-11 rounded-lg border border-slate-200 px-2" value={order.status} onChange={(e) => void updateStatus(order, e.target.value as OrderStatus)}>
                      <option>Pending</option><option>Preparing</option><option>Out for Delivery</option><option>Delivered</option><option>Cancelled</option>
                    </select>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2 md:hidden">
        {filtered.map((order) => (
          <article key={order.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{order.orderNumber}</span>
              <StatusBadge status={order.status} size="sm" />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="font-semibold text-slate-900">{order.customerName}</p>
              <p className="font-bold text-emerald-700">PHP {order.total.toLocaleString()}</p>
            </div>
            <p className="mt-1 truncate text-xs text-slate-500">{order.items.map((i) => `${i.qty}x ${i.name}`).join(", ")}</p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{new Date(order.createdAt).toLocaleString()}</span>
              <button onClick={() => { setSelected(order); setNextStatus(order.status); setNote(order.adminNote ?? ""); }} className="min-h-11 px-2 text-xs font-medium text-emerald-700">View</button>
            </div>
          </article>
        ))}
      </section>

      <SlideOverDrawer isOpen={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? `Order ${selected.orderNumber}` : "Order"} width="lg">
        {selected ? (
          <div className="space-y-4 pb-16 sm:pb-0">
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-sm font-semibold">{selected.customerName}</p>
              <p className="text-xs text-slate-500">{selected.customerPhone}</p>
              <p className="mt-1 text-xs text-slate-500">{selected.deliveryMode === "Delivery" ? (selected.deliveryAddress ?? "") : "Pick-up"}</p>
            </div>
            <div className="space-y-2">
              {selected.items.map((item) => (
                <div key={`${selected.id}-${item.id}`} className="flex items-center justify-between rounded-lg border border-slate-100 p-2 text-sm">
                  <span>{item.qty}x {item.name}</span>
                  <span>PHP {item.subtotal.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <OrderTimeline currentStatus={selected.status} />
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Admin Note</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-24 w-full rounded-lg border border-slate-200 p-3 text-[16px]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Update Status</span>
              <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as OrderStatus)} className="h-11 w-full rounded-lg border border-slate-200 px-3 text-[16px]">
                <option value="">Select status</option>
                <option value="Pending">Pending</option>
                <option value="Preparing">Preparing</option>
                <option value="Out for Delivery">Out for Delivery</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </label>
            <div className="fixed bottom-0 left-0 right-0 border-t border-slate-100 bg-white p-3 sm:static sm:border-0 sm:p-0">
              <button
                onClick={() => void saveSelectedChanges()}
                className="min-h-11 w-full rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800 active:scale-95"
              >
                Save Changes
              </button>
            </div>
          </div>
        ) : null}
      </SlideOverDrawer>

      <ConfirmModal
        isOpen={Boolean(cancelTarget)}
        title="Cancel order?"
        message="This will mark the order as Cancelled. Continue?"
        confirmLabel="Confirm Cancel"
        isDestructive
        onCancel={() => setCancelTarget(null)}
        onConfirm={async () => {
          if (!cancelTarget) return;
          const res = await fetch(`/api/admin/orders/${cancelTarget.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Cancelled" }),
          });
          const body = await res.json();
          if (!res.ok) {
            toast({ type: "error", title: "Update failed", message: body.error ?? "Failed to cancel order" });
          } else {
            setOrders((prev) => prev.map((o) => (o.id === cancelTarget.id ? { ...o, status: "Cancelled" } : o)));
            setSelected((prev) => prev && prev.id === cancelTarget.id ? { ...prev, status: "Cancelled" } : prev);
            toast({ type: "warning", title: "Order cancelled", message: `${cancelTarget.orderNumber} is now cancelled.` });
          }
          setCancelTarget(null);
        }}
      />
    </div>
  );
}
