"use client";

import { AnimatePresence, motion } from "framer-motion";
import { XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastType = "success" | "error" | "warning" | "info";

type ToastPayload = {
  title: string;
  message?: string;
  type: ToastType;
};

type ToastItem = ToastPayload & { id: string };

const ToastContext = createContext<{ push: (payload: ToastPayload) => void } | null>(null);

const styleMap: Record<ToastType, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (payload: ToastPayload) => {
      const id = Math.random().toString(36).slice(2);
      setItems((prev) => [...prev, { ...payload, id }]);
      window.setTimeout(() => remove(id), 3000);
    },
    [remove],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-20 left-4 right-4 z-[100] flex flex-col gap-2 md:left-auto md:right-4 md:top-4 md:bottom-auto md:w-full md:max-w-sm">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3 shadow-lg md:rounded-lg md:p-4 ${styleMap[item.type]}`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.title}</p>
                {item.message ? <p className="mt-1 text-xs">{item.message}</p> : null}
              </div>
              <button
                aria-label="Close notification"
                className="rounded-lg p-1 hover:bg-white/60"
                onClick={() => remove(item.id)}
              >
                <XCircle className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return {
    toast: ctx.push,
  };
}
