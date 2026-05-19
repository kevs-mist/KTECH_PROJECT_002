import type { Metadata } from "next";
import "./globals.css";
import "./src/lib/env";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "KTech Field CRM",
  description: "Secure, real-time field operations and ticket management console for KTech field engineers and dispatch admins.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
