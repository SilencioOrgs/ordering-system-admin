"use client";

import { Bell, ClipboardList, MessageCircle, ReceiptText, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/shared/Toast";
import { createClient } from "@/lib/supabase/client";

type AdminOrderNotificationRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
};

type AdminMessageNotificationRow = {
  id: string;
  unreadCount: number;
  updatedAt: string;
  customer: {
    name: string;
  };
  messages: Array<{
    content: string;
  }>;
};

type AdminCustomOrderNotificationRow = {
  id: string;
  unreadCount: number;
  updatedAt: string;
  status: string;
  customer: {
    name: string;
  };
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  href: string;
  createdAt: string;
  icon: "order" | "message" | "custom";
};

function formatRelativeTimestamp(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();

  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))}h ago`;

  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export function AdminNotificationsButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const previousIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    const [ordersResponse, messagesResponse, customOrdersResponse] = await Promise.all([
      fetch("/api/admin/orders", { cache: "no-store" }),
      fetch("/api/admin/messages", { cache: "no-store" }),
      fetch("/api/admin/custom-orders", { cache: "no-store" }),
    ]);

    const [ordersBody, messagesBody, customOrdersBody] = await Promise.all([
      ordersResponse.json(),
      messagesResponse.json(),
      customOrdersResponse.json(),
    ]);

    const nextItems: NotificationItem[] = [];

    const orders = (ordersBody.orders ?? []) as AdminOrderNotificationRow[];
    for (const order of orders) {
      if (order.paymentStatus === "Awaiting Verification") {
        nextItems.push({
          id: `order-payment-${order.id}-${order.paymentStatus}`,
          title: `Payment review needed for ${order.orderNumber}`,
          message: `${order.customerName} submitted an e-wallet receipt for verification.`,
          href: "/orders",
          createdAt: order.createdAt,
          icon: "order",
        });
        continue;
      }

      if (order.status === "Pending") {
        nextItems.push({
          id: `order-pending-${order.id}-${order.status}`,
          title: `Order ${order.orderNumber} is waiting`,
          message: `${order.customerName}'s order needs admin review.`,
          href: "/orders",
          createdAt: order.createdAt,
          icon: "order",
        });
      }
    }

    const conversations = (messagesBody.conversations ?? []) as AdminMessageNotificationRow[];
    for (const conversation of conversations) {
      if (conversation.unreadCount <= 0) continue;
      nextItems.push({
        id: `message-${conversation.id}-${conversation.unreadCount}-${conversation.updatedAt}`,
        title: `New message from ${conversation.customer.name}`,
        message: conversation.messages[0]?.content ?? "Customer sent a new message.",
        href: "/messages",
        createdAt: conversation.updatedAt,
        icon: "message",
      });
    }

    const requests = (customOrdersBody.requests ?? []) as AdminCustomOrderNotificationRow[];
    for (const request of requests) {
      if (request.unreadCount <= 0 && request.status !== "Pending Review") continue;
      nextItems.push({
        id: `custom-${request.id}-${request.unreadCount}-${request.status}-${request.updatedAt}`,
        title:
          request.status === "Pending Review"
            ? `Custom order ready for review`
            : `New custom order message from ${request.customer.name}`,
        message:
          request.status === "Pending Review"
            ? `${request.customer.name} submitted a custom order request.`
            : `${request.customer.name} sent an update in their custom order thread.`,
        href: "/custom-orders",
        createdAt: request.updatedAt,
        icon: "custom",
      });
    }

    nextItems.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    setItems(nextItems);

    const nextIds = new Set(nextItems.map((item) => item.id));
    if (hasLoadedRef.current) {
      for (const item of nextItems) {
        if (!previousIdsRef.current.has(item.id)) {
          toast({
            type: "info",
            title: item.title,
            message: item.message,
          });
        }
      }
    } else {
      hasLoadedRef.current = true;
    }

    previousIdsRef.current = nextIds;
  }, [toast]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchNotifications();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      void fetchNotifications();
    };

    const channel = supabase
      .channel("admin-notification-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "custom_order_messages" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "custom_order_threads" }, refresh)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchNotifications]);

  const unreadCount = items.length;

  const iconMap = useMemo(
    () => ({
      order: <ReceiptText className="h-4 w-4 text-emerald-600" />,
      message: <MessageCircle className="h-4 w-4 text-blue-600" />,
      custom: <ClipboardList className="h-4 w-4 text-amber-600" />,
    }),
    []
  );

  return (
    <div className="relative">
      <button
        aria-label="Open notifications"
        onClick={() => setIsOpen((current) => !current)}
        className="relative min-h-11 min-w-11 rounded-lg p-2 text-slate-600 hover:bg-slate-100 active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {isOpen ? (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              className="absolute right-0 top-14 z-40 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
                  <p className="text-xs text-slate-500">
                    {unreadCount > 0 ? `${unreadCount} item(s) need attention` : "All caught up"}
                  </p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[24rem] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">No new notifications.</div>
                ) : (
                  items.slice(0, 8).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setIsOpen(false);
                        router.push(item.href);
                      }}
                      className="flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="mt-0.5 rounded-lg bg-slate-100 p-2">{iconMap[item.icon]}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <span className="shrink-0 text-[11px] text-slate-400">{formatRelativeTimestamp(item.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.message}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
