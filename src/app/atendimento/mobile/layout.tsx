import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Controle Profissional — ScreenFlow Lite",
  description: "Controle remoto da fila de atendimentos pelo celular",
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
  appleWebApp: {
    capable: true,
    title: "ScreenFlow Lite",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#18181b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function SalaoMobileAtendimentoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
