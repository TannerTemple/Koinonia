import { BRAND } from "@koinonia/shared";
import type { Metadata, Viewport } from "next";
import { themeCss, themeScript } from "@/lib/theme";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: `${BRAND.name}`, template: `%s · ${BRAND.name}` },
  description: "Stay close to the people who matter. Reminders to reach out, notes to remember, a list of who to pray for.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F3EC" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1020" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-bg text-text antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
