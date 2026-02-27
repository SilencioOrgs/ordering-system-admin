"use client";

import { AnimatePresence, motion } from "framer-motion";

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  isDestructive,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}) {
  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />
          <motion.div
            className="fixed inset-0 z-[60] grid place-items-center px-4"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl md:p-6">
              <h3 className="text-base font-semibold text-slate-900 md:text-lg">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{message}</p>
              <div className="mt-5 flex flex-col-reverse gap-3 sm:mt-6 sm:flex-row-reverse">
                <button
                  onClick={onConfirm}
                  className={`min-h-11 flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                    isDestructive ? "bg-red-600 hover:bg-red-700 active:scale-95" : "bg-emerald-700 hover:bg-emerald-800 active:scale-95"
                  }`}
                >
                  {confirmLabel}
                </button>
                <button
                  onClick={onCancel}
                  className="min-h-11 flex-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
