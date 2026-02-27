"use client";

import { Bell, Menu } from "lucide-react";

import { AdminAvatar } from "@/components/shared/AdminAvatar";

export function Header({ onMenuClick, pageTitle }: { onMenuClick: () => void; pageTitle: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-100 bg-white/95 px-3 shadow-sm backdrop-blur-sm md:h-16 md:px-6">
      <div className="flex items-center gap-2 md:gap-3">
        <button
          aria-label="Open navigation menu"
          onClick={onMenuClick}
          className="min-h-11 min-w-11 rounded-lg p-2 text-slate-600 hover:bg-slate-100 active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="max-w-[200px] truncate text-lg font-semibold text-slate-900 md:max-w-none md:text-xl">{pageTitle}</h1>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <button
          aria-label="Open notifications"
          className="relative min-h-11 min-w-11 rounded-lg p-2 text-slate-600 hover:bg-slate-100 active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
        </button>
        <AdminAvatar name="Admin" size="md" />
      </div>
    </header>
  );
}
