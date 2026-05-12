import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/navbar";

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

export const metadata: Metadata = {
  title: "Families — Steam Gift Pooling",
  description: "Una-se com amigos para financiar jogos na lista de desejos da Steam",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans`}>
        <Providers>
          <Navbar />
          <main className="min-h-[calc(100vh-3.5rem)]">
            {children}
          </main>
          <footer className="border-t border-border/40 py-4 mt-8">
            <p className="text-center text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} RAPOZOTECH SOLUCOES INTELIGENTES LTDA &mdash; CNPJ 61.992.849/0001-83 &mdash; Todos os direitos reservados.
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
