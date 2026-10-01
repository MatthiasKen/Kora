import type { Metadata, Viewport } from "next";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/dm-serif-display/400.css";
import "@fontsource/dm-serif-display/400-italic.css";
import "./globals.css";
import "./modern.css";
import { StoreProvider } from "@/components/store-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartDrawer } from "@/components/cart-drawer";
import { QuickView } from "@/components/product-detail";
import { getProducts } from "@/lib/catalog";
import { storeConfig } from "@/lib/config";
import { emailTestOwner } from "@/lib/email-test-access";
import { ShoppingTools } from "@/components/shopping-tools";
import { storeOwner } from "@/lib/store-owner";
export const dynamic = "force-dynamic";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};
export const metadata: Metadata = {
  title: { default: "Kora — Everyday, elevated.", template: "%s · Kora" },
  description:
    "Thoughtfully picked electronics, fashion, home and beauty essentials. Better prices. Delivered across Nigeria.",
  metadataBase: new URL(
    process.env.APP_URL ||
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"),
  ),
  openGraph: {
    title: "Kora — Everyday, elevated.",
    description:
      "Good things for your everyday. Thoughtfully picked, fairly priced.",
    images: ["/images/hero.webp"],
  },
  icons: { icon: "/icon.svg" },
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [products, emailOwner, owner] = await Promise.all([
    getProducts(),
    emailTestOwner(),
    storeOwner(),
  ]);
  return (
    <html lang="en-NG" suppressHydrationWarning>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <StoreProvider
          products={products}
          config={{ ...storeConfig(), emailTestingAvailable: !!emailOwner, ownerToolsAvailable: !!owner }}
        >
          <SiteHeader />
          <main id="main-content">{children}</main>
          <SiteFooter />
          <CartDrawer />
          <QuickView />
          <ShoppingTools />
        </StoreProvider>
      </body>
    </html>
  );
}
