import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SessionProvider } from "next-auth/react";
import { validateRegistry } from "@/lib/registry.validate";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// Section 12: fail build/startup on a bad registry entry, not at usage time.
validateRegistry();

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Zenfyle — Every file tool in one workshop",
    template: "%s — Zenfyle",
  },
  description:
    "Free PDF, image, and document tools that run right in your browser. Merge, convert, compress, sign — no signup required.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // No auth() call here: reading the session cookie in the root layout would
  // force every page (homepage, all /tools/[slug]) into dynamic rendering and
  // undo Phase 4's static/SEO generation. The Header reads session client-side
  // via SessionProvider (useSession) instead, so the shell stays static.
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${jakarta.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-screen flex-col">
        <SessionProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}
