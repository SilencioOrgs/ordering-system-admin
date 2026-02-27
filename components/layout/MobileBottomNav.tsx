"use client";

import { LayoutDashboard, MessageCircle, Package, ReceiptText, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, dot: false },
  { href: "/orders", label: "Orders", icon: ReceiptText, dot: true },
  { href: "/messages", label: "Messages", icon: MessageCircle, dot: true },
  { href: "/products", label: "Products", icon: Package, dot: false },
  { href: "/settings", label: "Settings", icon: Settings, dot: false },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const [hasOrderAlert, setHasOrderAlert] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/orders")
      .then(async (res) => {
        if (!res.ok) return [];
        const body = await res.json();
        return body.orders ?? [];
      })
      .then((orders: Array<{ status: string }>) => {
        setHasOrderAlert(orders.some((order) => order.status === "Pending"));
      })
      .catch(() => setHasOrderAlert(false));
  }, []);
  const hasMessageAlert = false;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-100 bg-white pb-safe md:hidden">
      <div className="flex h-16">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          const showDot = item.href === "/orders" ? hasOrderAlert : item.href === "/messages" ? hasMessageAlert : false;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                active ? "text-emerald-700" : "text-slate-400"
              }`}
            >
              {showDot && item.dot ? <span className="absolute top-2 h-1.5 w-1.5 rounded-full bg-red-500" /> : null}
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
