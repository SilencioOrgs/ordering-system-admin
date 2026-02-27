"use client";

import {
  ClipboardList,
  LayoutDashboard,
  Leaf,
  type LucideIcon,
  LogOut,
  MessageCircle,
  Package,
  ReceiptText,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AdminAvatar } from "@/components/shared/AdminAvatar";
import { conversations, customOrderRequests, orders } from "@/lib/mockData";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: () => number;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: ReceiptText, badge: () => orders.filter((o) => o.status === "Pending").length },
  { href: "/messages", label: "Messages", icon: MessageCircle, badge: () => conversations.reduce((sum, c) => sum + c.unreadCount, 0) },
  { href: "/custom-orders", label: "Custom Orders", icon: ClipboardList, badge: () => customOrderRequests.filter((c) => c.status === "Pending Review").length },
  { href: "/products", label: "Products", icon: Package },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ isOpen, onClose, isMobile }: { isOpen: boolean; onClose: () => void; isMobile: boolean }) {
  const pathname = usePathname();

  return (
    <>
      {(isMobile && isOpen) ? <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onClose} /> : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 ${
          isMobile ? (isOpen ? "translate-x-0 transition-transform duration-300" : "-translate-x-full transition-transform duration-300") : "translate-x-0"
        } lg:translate-x-0`}
      >
        <div className="h-16 border-b border-slate-800 px-4">
          <div className="flex h-full items-center gap-3">
            <Leaf className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-white">Ate Ai&apos;s Kitchen</p>
              <span className="mt-1 inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] uppercase tracking-widest text-emerald-400">
                Admin Panel
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            const count = item.badge ? item.badge() : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={isMobile ? onClose : undefined}
                className={`mb-1 flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium select-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                  active
                    ? "border-l-2 border-emerald-500 bg-slate-800 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-emerald-400" : ""}`} />
                {item.label}
                {count > 0 ? <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] text-white">{count}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <AdminAvatar name="Admin" size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">Admin</p>
              <button
                className="mt-1 min-h-11 text-sm text-slate-400 transition-colors hover:text-red-400 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                <span className="inline-flex items-center gap-1">
                  <LogOut className="h-4 w-4" /> Logout
                </span>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
