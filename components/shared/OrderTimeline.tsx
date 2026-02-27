import { Check } from "lucide-react";
import type { OrderStatus } from "@/lib/types";

const steps = ["Order Placed", "Payment Confirmed", "Preparing", "Out for Delivery", "Delivered"];

function statusToIndex(status: OrderStatus) {
  if (status === "Pending") return 0;
  if (status === "Preparing") return 2;
  if (status === "Out for Delivery") return 3;
  if (status === "Delivered") return 4;
  return 0;
}

export function OrderTimeline({ currentStatus }: { currentStatus: OrderStatus }) {
  const activeIndex = statusToIndex(currentStatus);

  return (
    <>
      <div className="hidden sm:flex sm:items-start sm:gap-2">
        {steps.map((step, index) => {
          const completed = index < activeIndex;
          const active = index === activeIndex;
          return (
            <div key={step} className="flex flex-1 items-center">
              <div className="flex min-w-0 flex-col items-center gap-1">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                    completed
                      ? "border-emerald-700 bg-emerald-700 text-white"
                      : active
                        ? "border-emerald-700 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  {completed ? <Check className="h-3 w-3" /> : active ? <span className="h-2 w-2 rounded-full bg-emerald-700 animate-pulse" /> : null}
                </div>
                <span className={`text-xs ${active || completed ? "text-slate-700" : "text-slate-400"}`}>{step}</span>
              </div>
              {index < steps.length - 1 && <div className={`mx-1 h-0.5 flex-1 ${index < activeIndex ? "bg-emerald-700" : "bg-slate-200"}`} />}
            </div>
          );
        })}
      </div>

      <div className="space-y-2 sm:hidden">
        {steps.map((step, index) => {
          const completed = index < activeIndex;
          const active = index === activeIndex;
          const showLabel = active;
          return (
            <div key={step} className="flex items-start gap-2">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                    completed
                      ? "border-emerald-700 bg-emerald-700 text-white"
                      : active
                        ? "border-emerald-700 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  {completed ? <Check className="h-3 w-3" /> : active ? <span className="h-2 w-2 rounded-full bg-emerald-700 animate-pulse" /> : null}
                </div>
                {index < steps.length - 1 && <div className={`h-6 w-0.5 ${index < activeIndex ? "bg-emerald-700" : "bg-slate-200"}`} />}
              </div>
              <div className="pt-1">{showLabel ? <span className="text-[11px] text-slate-700">{step}</span> : <span className="text-[11px] text-slate-400">...</span>}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
