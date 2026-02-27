import { tokens } from "@/lib/tokens";
import type { OrderStatus } from "@/lib/types";

const defaultStyle = { bg: "#e2e8f0", text: "#334155", dot: "#64748b" };

export function StatusBadge({ status, size = "md" }: { status: OrderStatus | string; size?: "sm" | "md" }) {
  const statusStyle = (tokens.statusColors as Record<string, { bg: string; text: string; dot: string }>)[status] ?? defaultStyle;
  const sizeClass = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClass}`}
      style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusStyle.dot }} />
      {status}
    </span>
  );
}
