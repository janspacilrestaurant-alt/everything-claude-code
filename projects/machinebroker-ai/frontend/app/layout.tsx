import "./globals.css";
import type { Metadata } from "next";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "MachineBroker AI",
  description: "AI-driven B2B machinery brokerage dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Nav />
        <main className="container py-8">{children}</main>
      </body>
    </html>
  );
}
