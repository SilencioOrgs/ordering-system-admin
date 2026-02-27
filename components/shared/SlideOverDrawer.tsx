"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function SlideOverDrawer({
  isOpen,
  onClose,
  title,
  children,
  width = "md",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: "md" | "lg";
}) {
  const desktopWidth = width === "lg" ? "md:max-w-xl" : "md:max-w-md";

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className={`fixed z-50 flex bg-white shadow-2xl sm:right-0 sm:top-0 sm:h-full sm:w-full ${desktopWidth} sm:rounded-none max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:h-[90vh] max-sm:w-full max-sm:flex-col max-sm:rounded-t-2xl sm:flex-col sm:border-l sm:border-slate-100`}
            initial={{ y: typeof window !== "undefined" && window.innerWidth < 640 ? "100%" : 0, x: "100%" }}
            animate={{ y: 0, x: 0 }}
            exit={{ y: typeof window !== "undefined" && window.innerWidth < 640 ? "100%" : 0, x: "100%" }}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 md:px-6">
              <h2 className="text-base font-semibold text-slate-900 md:text-lg">{title}</h2>
              <button
                aria-label="Close drawer"
                className="rounded-lg p-1.5 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                onClick={onClose}
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">{children}</div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
