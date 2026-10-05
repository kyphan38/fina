import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import { BG_DARK, BG_LIGHT, THEME_SCRIPT } from "@/lib/prefs";

export const metadata: Metadata = {
  title: "fina",
  description: "Personal money log",
  icons: {
    icon: "/favicon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "fina", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // Khoá zoom: app là công cụ nhập nhanh, double-tap zoom chỉ gây lỗi chạm.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BG_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: BG_DARK },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme do THEME_SCRIPT đặt trước khi React hydrate.
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <ServiceWorkerRegistrar />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
