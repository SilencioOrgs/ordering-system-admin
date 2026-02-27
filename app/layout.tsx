import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import { ToastProvider } from "@/components/shared/Toast";

import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Ate Ai's Kitchen - Admin",
  description: "Admin Panel",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} min-h-screen bg-[var(--bg-page)] text-slate-900`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
