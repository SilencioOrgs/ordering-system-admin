"use client";

import { useEffect, useMemo, useState } from "react";

import { AdminAvatar } from "@/components/shared/AdminAvatar";
import { SlideOverDrawer } from "@/components/shared/SlideOverDrawer";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Customer } from "@/lib/types";

type ApiOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  createdAt: string;
  total: number;
  status: "Pending" | "Preparing" | "Out for Delivery" | "Delivered" | "Cancelled";
};

export default function CustomersPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<ApiOrder[]>([]);

  useEffect(() => {
    void fetch("/api/admin/orders")
      .then(async (res) => {
        if (!res.ok) return [];
        const body = await res.json();
        return (body.orders ?? []) as ApiOrder[];
      })
      .then((items) => setOrders(items))
      .catch(() => setOrders([]));
  }, []);

  const customers = useMemo(() => {
    const map = new Map<string, Customer>();

    for (const o of orders) {
      const key = `${o.customerName}::${o.customerPhone}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          id: key,
          name: o.customerName,
          phone: o.customerPhone,
          email: "",
          totalOrders: 1,
          totalSpent: Number(o.total ?? 0),
          lastOrderDate: String(o.createdAt).slice(0, 10),
          status: "Active",
        });
      } else {
        existing.totalOrders += 1;
        existing.totalSpent += Number(o.total ?? 0);
        if (String(o.createdAt) > existing.lastOrderDate) {
          existing.lastOrderDate = String(o.createdAt).slice(0, 10);
        }
      }
    }

    return Array.from(map.values());
  }, [orders]);

  const list = useMemo(
    () => customers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query)),
    [customers, query]
  );

  const selectedOrders = useMemo(
    () => orders.filter((o) => o.customerName === selected?.name && o.customerPhone === selected?.phone),
    [orders, selected]
  );

  return (
    <div className="space-y-4">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or phone" className="h-11 w-full max-w-md rounded-lg border border-slate-200 px-3 text-[16px]" />

      <section className="hidden overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-4 py-3">Avatar</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3 max-md:hidden">Email</th><th className="px-4 py-3">Total Orders</th><th className="px-4 py-3">Total Spent</th><th className="px-4 py-3 max-md:hidden">Last Order</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-3"><AdminAvatar name={c.name} size="sm" /></td>
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">{c.phone}</td>
                <td className="px-4 py-3 max-md:hidden">{c.email || "-"}</td>
                <td className="px-4 py-3">{c.totalOrders}</td>
                <td className="px-4 py-3">PHP {c.totalSpent.toLocaleString()}</td>
                <td className="px-4 py-3 max-md:hidden">{c.lastOrderDate}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3"><button onClick={() => setSelected(c)} className="min-h-11 rounded-lg px-3 text-xs font-medium text-emerald-700">View Orders</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2 md:hidden">
        {list.map((c) => (
          <article key={c.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><AdminAvatar name={c.name} size="sm" /><p className="font-semibold">{c.name}</p></div><StatusBadge status={c.status} size="sm" /></div>
            <p className="mt-2 text-xs text-slate-500">{c.phone}</p>
            <p className="mt-1 text-xs text-slate-500">Orders: {c.totalOrders} | Spent: PHP {c.totalSpent.toLocaleString()}</p>
            <button onClick={() => setSelected(c)} className="mt-2 min-h-11 text-xs font-medium text-emerald-700">View Orders</button>
          </article>
        ))}
      </section>

      <SlideOverDrawer isOpen={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? `${selected.name} Orders` : "Orders"} width="md">
        <div className="space-y-2">
          {selectedOrders.map((o) => (
            <div key={o.id} className="rounded-lg border border-slate-100 p-3">
              <div className="flex items-center justify-between"><p className="font-medium">{o.orderNumber}</p><StatusBadge status={o.status} size="sm" /></div>
              <p className="text-xs text-slate-500">{new Date(o.createdAt).toLocaleString()}</p>
              <p className="mt-1 text-sm">PHP {o.total.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </SlideOverDrawer>
    </div>
  );
}
