import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SupabaseEnvProvider } from "@/components/supabase-env-provider";
import {
  logSupabaseEnvDiagnostics,
  normalizePublicEnvValue,
  NEXT_PUBLIC_SUPABASE_ANON_KEY_KEY,
  NEXT_PUBLIC_SUPABASE_URL_KEY,
} from "@/lib/supabase";

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

/** Garante que `process.env.NEXT_PUBLIC_*` seja lido em runtime na Vercel (não só no tempo de build). */
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  logSupabaseEnvDiagnostics("root-layout");

  const supabasePublic = {
    url: normalizePublicEnvValue(process.env[NEXT_PUBLIC_SUPABASE_URL_KEY]),
    anonKey: normalizePublicEnvValue(process.env[NEXT_PUBLIC_SUPABASE_ANON_KEY_KEY]),
  };

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
