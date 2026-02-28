"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/components/shared/Toast";
import OrderApprovalMap from "@/components/shared/OrderApprovalMap";
import OrderStatusStepper from "@/components/shared/OrderStatusStepper";

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
  userId: string | null;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: "COD" | "GCash" | "Maya";
  paymentStatus: string;
  deliveryMode: "Delivery" | "Pick-up";
  deliveryAddress: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: "Pending" | "Preparing" | "Out for Delivery" | "Delivered" | "Cancelled";
  createdAt: string;
  adminNote: string | null;
  rejectionReason: string | null;
  rated: boolean;
  rating: number | null;
  ratingNote: string | null;
  deliveryTimeMinutes: number | null;
  items: AdminOrderItem[];
};

const tabs = ["All", "Pending Approval", "Preparing", "Out for Delivery", "Delivered", "Cancelled"] as const;
type TabValue = (typeof tabs)[number];

export default function OrdersPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabValue>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  const fetchOrders = useCallback(async () => {
    const response = await fetch("/api/admin/orders");
    const body = (await response.json()) as { orders?: AdminOrder[]; error?: string };

    if (!response.ok) {
      throw new Error(body.error ?? "Failed to load orders");
    }

    setOrders(body.orders ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchOrders().catch((error: unknown) => {
      setLoading(false);
      toast({
        type: "error",
        title: "Load failed",
        message: error instanceof Error ? error.message : "Failed to load orders",
      });
    });
  }, [fetchOrders, toast]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        void fetchOrders();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        query.length === 0 ||
        order.orderNumber.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.customerPhone.toLowerCase().includes(query);

      const matchesTab =
        activeTab === "All"
          ? true
          : activeTab === "Pending Approval"
            ? order.status === "Pending" && order.paymentMethod === "COD"
            : order.status === activeTab;

      return matchesSearch && matchesTab;
    });
  }, [activeTab, orders, searchQuery]);

  const updateOrderStatus = useCallback(
    async (
      orderId: string,
      status: AdminOrder["status"],
      extra?: { adminNote?: string }
    ) => {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          adminNote: extra?.adminNote,
        }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to update order");
      }

      await fetchOrders();
      toast({
        type: status === "Cancelled" ? "warning" : "success",
        title: "Order updated",
        message: `Order status changed to ${status}.`,
      });
    },
    [fetchOrders, toast]
  );

  const handleApprove = async (orderId: string) => {
    try {
      await updateOrderStatus(orderId, "Preparing");
      setSelectedOrder(null);
    } catch (error) {
      toast({
        type: "error",
        title: "Approve failed",
        message: error instanceof Error ? error.message : "Failed to approve order",
      });
    }
  };

  const handleReject = async (orderId: string, reason: string) => {
    try {
      await updateOrderStatus(orderId, "Cancelled", { adminNote: reason });
      setSelectedOrder(null);
    } catch (error) {
      toast({
        type: "error",
        title: "Reject failed",
        message: error instanceof Error ? error.message : "Failed to reject order",
      });
    }
  };

  const renderActions = (order: AdminOrder) => {
    if (order.status === "Pending") {
      if (order.paymentMethod === "COD") {
        return (
          <button
            onClick={() => setSelectedOrder(order)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Review Location
          </button>
        );
      }

      return (
        <button
          onClick={() => void updateOrderStatus(order.id, "Preparing").catch((error) => {
            toast({
              type: "error",
              title: "Update failed",
              message: error instanceof Error ? error.message : "Failed to update status",
            });
          })}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          Start Preparing
        </button>
      );
    }

    if (order.status === "Preparing") {
      return (
        <button
          onClick={() => void updateOrderStatus(order.id, "Out for Delivery").catch((error) => {
            toast({
              type: "error",
              title: "Update failed",
              message: error instanceof Error ? error.message : "Failed to update status",
            });
          })}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          Mark Out for Delivery
        </button>
      );
    }

    if (order.status === "Out for Delivery") {
      return (
        <button
          onClick={() => void updateOrderStatus(order.id, "Delivered").catch((error) => {
            toast({
              type: "error",
              title: "Update failed",
              message: error instanceof Error ? error.message : "Failed to update status",
            });
          })}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
        >
          Mark Delivered
        </button>
      );
    }

    if (order.status === "Delivered") {
      return <span className="text-sm font-semibold text-emerald-700">Delivered</span>;
    }

    return <span className="text-sm font-semibold text-red-600">Cancelled</span>;
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm md:p-4">
        <div className="grid gap-2 lg:grid-cols-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search order, customer, or phone"
              className="h-11 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-[16px] focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  activeTab === tab ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((row) => (
            <div key={row} className="h-36 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <section className="rounded-xl border border-slate-100 bg-white p-8 text-center shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">No orders found</h3>
          <p className="mt-1 text-sm text-slate-500">Try a different tab or search query.</p>
        </section>
      ) : (
        <section className="space-y-3">
          {filteredOrders.map((order) => (
            <article key={order.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{order.orderNumber}</p>
                    <StatusBadge status={order.status} size="sm" />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {order.customerName} - {order.customerPhone}
                  </p>
                  <p className="text-xs text-slate-500">
                    {order.deliveryMode === "Delivery" ? order.deliveryAddress ?? "No address" : "Pick-up"}
                  </p>
                </div>

                <div className="text-left md:text-right">
                  <p className="text-sm text-slate-500">
                    {new Date(order.createdAt).toLocaleString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {order.paymentMethod} - {order.paymentStatus === "Verified" ? "Paid" : order.paymentStatus}
                  </p>
                  <p className="text-lg font-bold text-emerald-700">PHP {order.total.toFixed(2)}</p>
                </div>
              </div>

              {order.paymentMethod === "COD" ? (
                <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  Amount to collect on delivery: PHP {order.total.toFixed(2)}
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  {order.paymentMethod} payment is {order.paymentStatus === "Verified" ? "Paid (mock)" : order.paymentStatus}. Total: PHP {order.total.toFixed(2)}
                </div>
              )}

              <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
                {order.items.map((item) => (
                  <div key={`${order.id}-${item.id}`} className="flex items-center justify-between">
                    <span>
                      {item.qty}x {item.name}
                    </span>
                    <span>PHP {item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <OrderStatusStepper status={order.status} />
              </div>

              {order.status === "Cancelled" && (order.adminNote || order.rejectionReason) && (
                <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
                  <strong>Reason:</strong> {order.adminNote ?? order.rejectionReason}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">{renderActions(order)}</div>
            </article>
          ))}
        </section>
      )}

      {selectedOrder && (
        <OrderApprovalMap
          order={selectedOrder}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
