"use client";

import { CircleDollarSign, MessageCircle, ShoppingCart, Timer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { StatusBadge } from "@/components/shared/StatusBadge";

type DashboardOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  paymentMethod: string;
  status: "Pending" | "Preparing" | "Out for Delivery" | "Delivered" | "Cancelled";
  createdAt: string;
  total: number;
};

export default function DashboardPage() {
  const [orders, setOrders] = useState<DashboardOrder[]>([]);

  useEffect(() => {
    void fetch("/api/admin/orders")
      .then(async (res) => {
        if (!res.ok) return [];
        const body = await res.json();
        return (body.orders ?? []) as DashboardOrder[];
      })
      .then((items) => setOrders(items))
      .catch(() => setOrders([]));
  }, []);

  const { todayOrders, pendingOrders, revenue } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todays = orders.filter((o) => String(o.createdAt).slice(0, 10) === today);
    const pending = orders.filter((o) => o.status === "Pending");
    const rev = todays.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
    return { todayOrders: todays, pendingOrders: pending, revenue: rev };
  }, [orders]);

  return (
    <div className="space-y-4 md:space-y-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total Orders Today", value: String(todayOrders.length), icon: ShoppingCart },
          { label: "Pending Orders", value: String(pendingOrders.length), icon: Timer },
          { label: "Revenue Today", value: `PHP ${revenue.toLocaleString()}`, icon: CircleDollarSign },
          { label: "New Messages", value: "6", icon: MessageCircle },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-xl border border-slate-50 bg-white p-3 shadow-sm md:rounded-2xl md:p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 md:h-11 md:w-11">
                  <Icon className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                <span className="text-[10px] text-slate-500 md:text-xs">vs yesterday</span>
              </div>
              <p className="mt-3 text-xl font-semibold text-slate-900 md:text-2xl">{card.value}</p>
              <p className="text-[11px] text-slate-500 md:text-sm">{card.label}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-900">Recent Orders</h2>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 5).map((order) => (
                  <tr key={order.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">{order.orderNumber}</td>
                    <td className="px-4 py-3">{order.customerName}</td>
                    <td className="px-4 py-3">PHP {order.total.toLocaleString()}</td>
                    <td className="px-4 py-3 max-lg:hidden">{order.paymentMethod}</td>
                    <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 md:hidden">
            {orders.slice(0, 5).map((order) => (
              <article key={order.id} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{order.orderNumber}</span>
                  <StatusBadge status={order.status} size="sm" />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{order.customerName}</p>
                  <p className="text-sm font-semibold text-emerald-700">PHP {order.total.toLocaleString()}</p>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{new Date(order.createdAt).toLocaleString()}</span>
                  <button className="min-h-11 rounded-lg px-3 text-emerald-700">View</button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Quick Actions</h3>
          <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:flex-wrap">
            <button className="min-h-11 w-full rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800 active:scale-95">
              Add New Product
            </button>
            <button className="min-h-11 w-full rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 active:scale-95">
              View Pending Orders
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
}
