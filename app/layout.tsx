import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/navbar";
import { getServerTranslations } from "@/lib/i18n/server";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL
  ?? process.env.APP_BASE_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Families — Steam Gift Pooling",
  description: "Una-se com amigos para financiar jogos na lista de desejos da Steam",
  openGraph: {
    type: "website",
    url: appUrl,
    title: "Families — Steam Gift Pooling",
    description: "Una-se com amigos para financiar jogos na lista de desejos da Steam",
    images: [{ url: "/images/thumb-sharing-image.jpg", width: 1200, height: 630, type: "image/jpeg" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/images/thumb-sharing-image.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { t } = getServerTranslations();
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans`}>
        <Providers>
          <Navbar />
          <main className="min-h-[calc(100vh-3.5rem)]">
            {children}
          </main>
          <footer className="border-t border-border/40 py-4 mt-8">
            <div className="flex flex-col items-center gap-1">
              <p className="text-center text-xs text-muted-foreground">
                &copy; {new Date().getFullYear()} RAPOZOTECH SOLUCOES INTELIGENTES LTDA &mdash; CNPJ 61.992.849/0001-83
              </p>
              <div className="flex gap-4 text-xs text-muted-foreground/70">
                <a href="/terms" className="hover:text-muted-foreground transition-colors">{t.layout.terms}</a>
                <a href="/privacy" className="hover:text-muted-foreground transition-colors">{t.layout.privacy}</a>
                <a href="mailto:contato@families.app" className="hover:text-muted-foreground transition-colors">{t.layout.contact}</a>
              </div>
            </div>
          </footer>
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
