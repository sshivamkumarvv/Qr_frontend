import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { PwaRegister } from "@/app/components/PwaRegister";

export const metadata: Metadata = {
  title: "DineIn — Scan & Order",
  description: "Scan your table QR code and order delicious food instantly.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DineIn",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#ff5722",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Anti-flash inline script to enforce theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var m = localStorage.getItem('dinein_theme_mode') || 'light';
                  var c = localStorage.getItem('dinein_theme_color') || 'orange';
                  document.documentElement.setAttribute('data-theme', m);
                  var colors = {
                    orange: { p: '#ff5722', s: '#ff8c3b', g: 'rgba(255, 87, 34, 0.3)', b: 'rgba(255, 87, 34, 0.1)', br: 'rgba(255, 87, 34, 0.28)' },
                    emerald: { p: '#10b981', s: '#34d399', g: 'rgba(16, 185, 129, 0.3)', b: 'rgba(16, 185, 129, 0.1)', br: 'rgba(16, 185, 129, 0.28)' },
                    violet: { p: '#7c3aed', s: '#9333ea', g: 'rgba(124, 58, 237, 0.3)', b: 'rgba(124, 58, 237, 0.1)', br: 'rgba(124, 58, 237, 0.28)' },
                    rose: { p: '#e11d48', s: '#f43f5e', g: 'rgba(225, 29, 72, 0.3)', b: 'rgba(225, 29, 72, 0.1)', br: 'rgba(225, 29, 72, 0.28)' },
                    blue: { p: '#2563eb', s: '#3b82f6', g: 'rgba(37, 99, 235, 0.3)', b: 'rgba(37, 99, 235, 0.1)', br: 'rgba(37, 99, 235, 0.28)' },
                    amber: { p: '#d97706', s: '#f59e0b', g: 'rgba(217, 119, 6, 0.3)', b: 'rgba(217, 119, 6, 0.1)', br: 'rgba(217, 119, 6, 0.28)' }
                  };
                  var sel = colors[c] || colors.orange;
                  document.documentElement.style.setProperty('--accent', sel.p);
                  document.documentElement.style.setProperty('--accent-2', sel.s);
                  document.documentElement.style.setProperty('--accent-glow', sel.g);
                  document.documentElement.style.setProperty('--accent-bg', sel.b);
                  document.documentElement.style.setProperty('--accent-border', sel.br);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <PwaRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
