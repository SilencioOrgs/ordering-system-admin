"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ClipboardCopy,
  ExternalLink,
  Eye,
  PencilLine,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/components/shared/Toast";
import OrderApprovalMap from "@/components/shared/OrderApprovalMap";
import { createClient } from "@/lib/supabase/client";

type AdminOrderItem = {
  id: string;
  productId: string | null;
  name: string;
  qty: number;
  price: number;
  subtotal: number;
};

type PaymentReceiptExtraction = {
  extractionStatus: string;
  referenceNumber: string | null;
  recipientName: string | null;
  recipientMobileNumber: string | null;
  amount: number | null;
  currency: string | null;
  transactionDateText: string | null;
  transactionTimestamp: string | null;
  sourceImageUrl: string | null;
  extractionError: string | null;
};

type AdminOrderStatus = "Pending" | "Preparing" | "Out for Delivery" | "Delivered" | "Cancelled";
type AdminPaymentStatus = "Pending" | "Awaiting Verification" | "Verified" | "Rejected";

type AdminOrder = {
  id: string;
  userId: string | null;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: "COD" | "GCash" | "Maya";
  paymentStatus: AdminPaymentStatus | string;
  paymentProofUrl: string | null;
  deliveryMode: "Delivery" | "Pick-up";
  deliveryAddress: string | null;
  streetAddress: string | null;
  barangayName: string | null;
  cityMunicipalityName: string | null;
  provinceName: string | null;
  regionName: string | null;
  landmark: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: AdminOrderStatus;
  createdAt: string;
  adminNote: string | null;
  rejectionReason: string | null;
  rated: boolean;
  rating: number | null;
  ratingNote: string | null;
  deliveryTimeMinutes: number | null;
  receiptExtraction: PaymentReceiptExtraction | null;
  items: AdminOrderItem[];
};

const tabs = ["All", "Pending Approval", "Preparing", "Out for Delivery", "Delivered", "Cancelled"] as const;
type TabValue = (typeof tabs)[number];

type OrderPatchInput = {
  status?: AdminOrderStatus;
  paymentStatus?: AdminPaymentStatus;
  adminNote?: string;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildAddressText(order: AdminOrder) {
  if (order.deliveryMode !== "Delivery") {
    return "Pick-up";
  }

  const fallbackParts = [
    order.streetAddress,
    order.barangayName,
    order.cityMunicipalityName,
    order.provinceName,
    order.landmark ? `Landmark: ${order.landmark}` : null,
  ]
    .map((value) => value?.trim() || "")
    .filter(Boolean);

  return order.deliveryAddress?.trim() || fallbackParts.join(", ") || "No delivery address";
}

function buildItemSummary(order: AdminOrder) {
  if (order.items.length === 0) {
    return "No items";
  }

  return order.items
    .slice(0, 2)
    .map((item) => `${item.qty}x ${item.name}`)
    .join(", ");
}

function getStatusOptions(order: AdminOrder): AdminOrderStatus[] {
  if (order.status === "Pending") {
    return order.deliveryMode === "Delivery" ? ["Preparing", "Cancelled"] : ["Preparing", "Delivered", "Cancelled"];
  }

  if (order.status === "Preparing") {
    return order.deliveryMode === "Delivery" ? ["Out for Delivery", "Delivered", "Cancelled"] : ["Delivered", "Cancelled"];
  }

  if (order.status === "Out for Delivery") {
    return ["Delivered", "Cancelled"];
  }

  return [];
}

function ModalShell({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabValue>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [addressReviewOrder, setAddressReviewOrder] = useState<AdminOrder | null>(null);
  const [paymentReviewOrder, setPaymentReviewOrder] = useState<AdminOrder | null>(null);
  const [addressPreviewOrder, setAddressPreviewOrder] = useState<AdminOrder | null>(null);
  const [statusEditorOrder, setStatusEditorOrder] = useState<AdminOrder | null>(null);
  const [statusDraft, setStatusDraft] = useState<AdminOrderStatus>("Preparing");
  const [rejectOrderTarget, setRejectOrderTarget] = useState<AdminOrder | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    const refreshOrders = () => {
      void fetchOrders().catch((error: unknown) => {
        toast({
          type: "error",
          title: "Realtime update failed",
          message: error instanceof Error ? error.message : "Failed to refresh orders",
        });
      });
    };

    const channel = supabase
      .channel("admin-orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refreshOrders)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, refreshOrders)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_receipt_extractions" }, refreshOrders)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchOrders, toast]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        query.length === 0 ||
        order.orderNumber.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.customerPhone.toLowerCase().includes(query) ||
        buildAddressText(order).toLowerCase().includes(query) ||
        (order.receiptExtraction?.referenceNumber ?? "").toLowerCase().includes(query);

      const needsApproval = order.paymentStatus === "Awaiting Verification" || order.status === "Pending";
      const matchesTab =
        activeTab === "All" ? true : activeTab === "Pending Approval" ? needsApproval : order.status === activeTab;

      return matchesSearch && matchesTab;
    });
  }, [activeTab, orders, searchQuery]);

  const patchOrder = useCallback(
    async (orderId: string, payload: OrderPatchInput, successMessage: string) => {
      setIsSubmitting(true);
      try {
        const response = await fetch(`/api/admin/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const body = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(body.error ?? "Failed to update order");
        }

        await fetchOrders();
        toast({
          type: payload.status === "Cancelled" || payload.paymentStatus === "Rejected" ? "warning" : "success",
          title: "Order updated",
          message: successMessage,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [fetchOrders, toast]
  );

  const closeAllModals = () => {
    setPaymentReviewOrder(null);
    setAddressPreviewOrder(null);
    setStatusEditorOrder(null);
    setRejectOrderTarget(null);
    setAddressReviewOrder(null);
    setRejectionReason("");
  };

  const handleApprovePayment = async (order: AdminOrder) => {
    try {
      await patchOrder(order.id, { paymentStatus: "Verified" }, "Payment approved and ready for order review.");
      setPaymentReviewOrder(null);
    } catch (error) {
      toast({
        type: "error",
        title: "Payment review failed",
        message: error instanceof Error ? error.message : "Failed to approve payment",
      });
    }
  };

  const handleApproveAddress = async (orderId: string) => {
    try {
      await patchOrder(orderId, { status: "Preparing" }, "Order approved and moved to Preparing.");
      setAddressReviewOrder(null);
    } catch (error) {
      toast({
        type: "error",
        title: "Address approval failed",
        message: error instanceof Error ? error.message : "Failed to approve address",
      });
    }
  };

  const handleReject = async (order: AdminOrder, reason: string) => {
    try {
      await patchOrder(
        order.id,
        {
          status: "Cancelled",
          paymentStatus:
            order.paymentMethod !== "COD" && order.paymentStatus !== "Verified" ? "Rejected" : undefined,
          adminNote: reason.trim() || "Order rejected by admin",
        },
        "Order rejected."
      );
      closeAllModals();
    } catch (error) {
      toast({
        type: "error",
        title: "Reject failed",
        message: error instanceof Error ? error.message : "Failed to reject order",
      });
    }
  };

  const handleUpdateStatus = async () => {
    if (!statusEditorOrder) {
      return;
    }

    try {
      await patchOrder(
        statusEditorOrder.id,
        { status: statusDraft },
        `Order status changed to ${statusDraft}.`
      );
      setStatusEditorOrder(null);
    } catch (error) {
      toast({
        type: "error",
        title: "Status update failed",
        message: error instanceof Error ? error.message : "Failed to update order status",
      });
    }
  };

  const openStatusEditor = (order: AdminOrder) => {
    const options = getStatusOptions(order);
    setStatusDraft(options[0] ?? order.status);
    setStatusEditorOrder(order);
  };

  const handleCopyAddress = async (order: AdminOrder) => {
    const addressText = buildAddressText(order);
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(addressText);
      toast({
        type: "success",
        title: "Address copied",
        message: "The delivery address is ready to paste into Lalamove.",
      });
    } catch {
      toast({
        type: "error",
        title: "Copy failed",
        message: "Could not copy the address.",
      });
    }
  };

  const renderActions = (order: AdminOrder) => {
    const isWalletPayment = order.paymentMethod === "GCash" || order.paymentMethod === "Maya";
    const receiptImageUrl = order.paymentProofUrl ?? order.receiptExtraction?.sourceImageUrl ?? null;
    const needsPaymentReview = isWalletPayment && order.paymentStatus === "Awaiting Verification";
    const canReviewAddress =
      order.deliveryMode === "Delivery" &&
      order.status === "Pending" &&
      (!isWalletPayment || order.paymentStatus === "Verified");
    const canUpdateStatus =
      !needsPaymentReview &&
      order.status !== "Cancelled" &&
      order.status !== "Delivered" &&
      !(order.status === "Pending" && order.deliveryMode === "Delivery");
    const canReject = order.status !== "Cancelled" && order.status !== "Delivered";

    return (
      <div className="flex min-w-[250px] flex-wrap gap-2">
        {needsPaymentReview ? (
          <button
            onClick={() => setPaymentReviewOrder(order)}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Review Payment
          </button>
        ) : null}

        {!needsPaymentReview && receiptImageUrl ? (
          <button
            onClick={() => setPaymentReviewOrder(order)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Eye className="h-3.5 w-3.5" />
            View Receipt
          </button>
        ) : null}

        {canReviewAddress ? (
          <button
            onClick={() => setAddressReviewOrder(order)}
            className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-800"
          >
            Review Address
          </button>
        ) : null}

        {canUpdateStatus ? (
          <button
            onClick={() => openStatusEditor(order)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <PencilLine className="h-3.5 w-3.5" />
            Update Status
          </button>
        ) : null}

        {order.deliveryMode === "Delivery" ? (
          <button
            onClick={() => setAddressPreviewOrder(order)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Eye className="h-3.5 w-3.5" />
            View Address
          </button>
        ) : null}

        {canReject ? (
          <button
            onClick={() => {
              setRejectOrderTarget(order);
              setRejectionReason(order.adminNote ?? "");
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
          >
            <XCircle className="h-3.5 w-3.5" />
            Reject
          </button>
        ) : null}
      </div>
    );
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
              placeholder="Search order, customer, phone, address, or reference"
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
        <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] divide-y divide-slate-100 text-left">
              <thead className="bg-slate-50">
                <tr className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Delivery</th>
                  <th className="px-4 py-3 font-semibold">Payment</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="align-top">
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900">{order.orderNumber}</p>
                        <p className="text-sm text-slate-500">{formatDateTime(order.createdAt)}</p>
                        <p className="text-sm text-slate-600">{buildItemSummary(order)}</p>
                        <p className="text-xs text-slate-400">{order.items.length} item(s)</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900">{order.customerName}</p>
                        <p className="text-sm text-slate-600">{order.customerPhone || "No phone provided"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-800">{order.deliveryMode}</p>
                        <p className="max-w-xs text-sm text-slate-600">{buildAddressText(order)}</p>
                        {order.deliveryMode === "Delivery" && order.landmark ? (
                          <p className="text-xs text-slate-500">Landmark: {order.landmark}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{order.paymentMethod}</span>
                            <StatusBadge status={order.paymentStatus === "Verified" ? "Verified" : order.paymentStatus} size="sm" />
                          </div>
                        {order.receiptExtraction?.referenceNumber ? (
                          <p className="text-sm text-slate-600">
                            Ref: <span className="font-semibold text-slate-800">{order.receiptExtraction.referenceNumber}</span>
                          </p>
                        ) : order.receiptExtraction ? (
                          <p className="text-sm text-amber-700">
                            Receipt uploaded, but reference details need review
                          </p>
                        ) : (
                          <p className="text-sm text-slate-500">
                            {order.paymentMethod === "COD" ? "Collect on delivery" : "No verified receipt details saved yet"}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <p className="text-base font-bold text-emerald-700">{formatCurrency(order.total)}</p>
                        <p className="text-xs text-slate-500">
                          Subtotal {formatCurrency(order.subtotal)}
                          {order.deliveryFee > 0 ? ` + delivery ${formatCurrency(order.deliveryFee)}` : ""}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <StatusBadge status={order.status} size="sm" />
                        {order.adminNote ? <p className="max-w-[220px] text-xs text-slate-500">{order.adminNote}</p> : null}
                      </div>
                    </td>
                    <td className="px-4 py-4">{renderActions(order)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {addressReviewOrder ? (
        <OrderApprovalMap
          order={addressReviewOrder}
          onApprove={handleApproveAddress}
          onReject={(orderId, reason) => {
            const order = orders.find((item) => item.id === orderId);
            if (order) {
              void handleReject(order, reason);
            }
          }}
          onClose={() => setAddressReviewOrder(null)}
        />
      ) : null}

      {paymentReviewOrder ? (
        <ModalShell
          title={paymentReviewOrder.paymentStatus === "Awaiting Verification" ? "Approve Wallet Payment" : "View Wallet Receipt"}
          subtitle={`${paymentReviewOrder.orderNumber} - ${paymentReviewOrder.customerName}`}
          onClose={() => setPaymentReviewOrder(null)}
        >
          <div className="space-y-4">
            {paymentReviewOrder.paymentProofUrl || paymentReviewOrder.receiptExtraction?.sourceImageUrl ? (
              <div className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                <div className="relative h-72 w-full bg-white">
                  <Image
                    src={paymentReviewOrder.paymentProofUrl ?? paymentReviewOrder.receiptExtraction?.sourceImageUrl ?? ""}
                    alt={`Receipt for ${paymentReviewOrder.orderNumber}`}
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Payment Method</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{paymentReviewOrder.paymentMethod}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Order Total</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(paymentReviewOrder.total)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Reference Number</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {paymentReviewOrder.receiptExtraction?.referenceNumber ?? "Not extracted"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Receipt Amount</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {paymentReviewOrder.receiptExtraction?.amount !== null && paymentReviewOrder.receiptExtraction?.amount !== undefined
                    ? `${paymentReviewOrder.receiptExtraction.currency ?? "PHP"} ${paymentReviewOrder.receiptExtraction.amount.toLocaleString()}`
                    : "Not extracted"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Recipient Name</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {paymentReviewOrder.receiptExtraction?.recipientName ?? "Not extracted"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Recipient Number</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {paymentReviewOrder.receiptExtraction?.recipientMobileNumber ?? "Not extracted"}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Transaction Date</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {paymentReviewOrder.receiptExtraction?.transactionDateText ??
                    paymentReviewOrder.receiptExtraction?.transactionTimestamp ??
                    "Not extracted"}
                </p>
              </div>
            </div>

            {paymentReviewOrder.paymentProofUrl || paymentReviewOrder.receiptExtraction?.sourceImageUrl ? (
              <a
                href={paymentReviewOrder.paymentProofUrl ?? paymentReviewOrder.receiptExtraction?.sourceImageUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Open Uploaded Receipt
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}

            {paymentReviewOrder.receiptExtraction?.extractionError ? (
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Extraction note: {paymentReviewOrder.receiptExtraction.extractionError}
              </div>
            ) : null}

            {paymentReviewOrder.paymentStatus === "Awaiting Verification" ? (
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={() => void handleApprovePayment(paymentReviewOrder)}
                  disabled={isSubmitting}
                  className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Approve Payment
                </button>
                <button
                  onClick={() => {
                    setRejectOrderTarget(paymentReviewOrder);
                    setRejectionReason(paymentReviewOrder.adminNote ?? "Payment reference did not match.");
                    setPaymentReviewOrder(null);
                  }}
                  disabled={isSubmitting}
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reject Order
                </button>
              </div>
            ) : null}
          </div>
        </ModalShell>
      ) : null}

      {addressPreviewOrder ? (
        <ModalShell
          title="View Delivery Address"
          subtitle={`${addressPreviewOrder.orderNumber} - ${addressPreviewOrder.customerName}`}
          onClose={() => setAddressPreviewOrder(null)}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Complete Address</p>
              <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-900">{buildAddressText(addressPreviewOrder)}</p>
              {addressPreviewOrder.deliveryLat !== null && addressPreviewOrder.deliveryLng !== null ? (
                <p className="mt-3 text-xs text-slate-500">
                  Coordinates: {addressPreviewOrder.deliveryLat}, {addressPreviewOrder.deliveryLng}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void handleCopyAddress(addressPreviewOrder)}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
              >
                <ClipboardCopy className="h-4 w-4" />
                Copy Address
              </button>
              {addressPreviewOrder.deliveryLat !== null && addressPreviewOrder.deliveryLng !== null ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${addressPreviewOrder.deliveryLat},${addressPreviewOrder.deliveryLng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Open Map
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </div>
        </ModalShell>
      ) : null}

      {statusEditorOrder ? (
        <ModalShell
          title="Update Order Status"
          subtitle={`${statusEditorOrder.orderNumber} - ${statusEditorOrder.customerName}`}
          onClose={() => setStatusEditorOrder(null)}
        >
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Select new status</span>
              <select
                value={statusDraft}
                onChange={(event) => setStatusDraft(event.target.value as AdminOrderStatus)}
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {getStatusOptions(statusEditorOrder).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void handleUpdateStatus()}
                disabled={isSubmitting}
                className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save Status
              </button>
              <button
                onClick={() => setStatusEditorOrder(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {rejectOrderTarget ? (
        <ModalShell
          title="Reject Order"
          subtitle={`${rejectOrderTarget.orderNumber} - ${rejectOrderTarget.customerName}`}
          onClose={() => {
            setRejectOrderTarget(null);
            setRejectionReason("");
          }}
        >
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Reason</span>
              <textarea
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                rows={4}
                className="w-full rounded-lg border border-slate-200 px-3 py-3 text-sm focus-visible:ring-2 focus-visible:ring-red-500"
                placeholder="Explain why the order is being rejected."
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void handleReject(rejectOrderTarget, rejectionReason)}
                disabled={isSubmitting || !rejectionReason.trim()}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Confirm Rejection
              </button>
              <button
                onClick={() => {
                  setRejectOrderTarget(null);
                  setRejectionReason("");
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
