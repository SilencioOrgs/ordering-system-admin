import { cn } from "@/lib/utils";

export function AdminAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sizeClass = size === "sm" ? "h-9 w-9 text-xs" : size === "lg" ? "h-14 w-14 text-lg" : "h-10 w-10 text-sm";

  return (
    <div className={cn("flex items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700", sizeClass)}>
      {initials}
    </div>
  );
}
