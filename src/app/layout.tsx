import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SupabaseEnvProvider } from "@/components/supabase-env-provider";
import { finalizeSupabasePublicPair, logSupabaseEnvDiagnostics, resolveSupabaseEnvPairs } from "@/lib/supabase";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ScreenFlow Lite",
  description: "Gestão de fila e chamadas",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  logSupabaseEnvDiagnostics("root-layout");

  const supabasePublic = finalizeSupabasePublicPair(resolveSupabaseEnvPairs());

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SupabaseEnvProvider value={supabasePublic}>{children}</SupabaseEnvProvider>
      </body>
    </html>
  );
}
