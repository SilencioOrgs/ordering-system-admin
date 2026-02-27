"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { Header } from "@/components/layout/Header";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Sidebar } from "@/components/layout/Sidebar";

const titleMap: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/orders": "Orders",
  "/messages": "Messages",
  "/custom-orders": "Custom Orders",
  "/products": "Products",
  "/customers": "Customers",
  "/settings": "Settings",
};

export default function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const title = useMemo(() => titleMap[pathname] ?? "Admin", [pathname]);

  return (
    <div className="min-h-screen lg:flex lg:flex-row">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isMobile />
      <div className="w-full lg:ml-64">
        <Header pageTitle={title} onMenuClick={() => setIsSidebarOpen(true)} />
        <main id="main-content" className="mx-auto w-full max-w-7xl p-3 pb-20 md:p-6 md:pb-20 lg:pb-6">
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
