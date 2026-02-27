export const tokens = {
  colors: {
    primary: "#047857",
    primaryLight: "#d1fae5",
    primaryHover: "#065f46",
    sidebar: "#0f172a",
    sidebarHover: "#1e293b",
    sidebarActive: "#1e293b",
    pageBg: "#FDFBF7",
    cardBg: "#ffffff",
    border: "#f1f5f9",
    textPrimary: "#0f172a",
    textSecondary: "#64748b",
    textMuted: "#94a3b8",
  },
  statusColors: {
    Pending: { bg: "#fef9c3", text: "#854d0e", dot: "#ca8a04" },
    Preparing: { bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
    "Out for Delivery": { bg: "#ede9fe", text: "#5b21b6", dot: "#8b5cf6" },
    Delivered: { bg: "#d1fae5", text: "#065f46", dot: "#10b981" },
    Cancelled: { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  },
} as const;
