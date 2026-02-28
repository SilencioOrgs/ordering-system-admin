"use client";

import { Check, Circle } from "lucide-react";

const steps = ["Pending", "Preparing", "Out for Delivery", "Delivered"] as const;

function getStatusIndex(status: string) {
  if (status === "Pending") return 0;
  if (status === "Preparing") return 1;
  if (status === "Out for Delivery") return 2;
  if (status === "Delivered") return 3;
  return 0;
}

export default function OrderStatusStepper({ status }: { status: string }) {
  const activeIndex = getStatusIndex(status);
  const isCancelled = status === "Cancelled";

  if (isCancelled) {
    return <div className="rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">Cancelled</div>;
  }

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, index) => {
        const completed = index < activeIndex || status === "Delivered";
        const active = index === activeIndex && status !== "Delivered";
        return (
          <div key={step} className="flex flex-1 items-center">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                completed
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : active
                    ? "border-emerald-700 text-emerald-700"
                    : "border-slate-200 text-slate-300"
              }`}
              title={step}
            >
              {completed ? <Check className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5 fill-current" />}
            </div>
            {index < steps.length - 1 && (
              <div className={`mx-1 h-0.5 flex-1 ${index < activeIndex || status === "Delivered" ? "bg-emerald-700" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
