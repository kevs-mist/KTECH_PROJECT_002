import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Prime Services CRM",
  description: "Secure, real-time field operations and ticket management console for Prime field engineers and dispatch admins.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
