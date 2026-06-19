import type { NextConfig } from "next";

/**
 * Não usamos `env` aqui: variáveis `NEXT_PUBLIC_*` são expostas automaticamente pelo Next
 * no cliente e no SSR; não é necessário (nem recomendado) duplicá-las manualmente neste arquivo.
 *
 * Produção na Vercel: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
 * em Project → Settings → Environment Variables e gere um novo deploy.
 */
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/favicon.ico",
        destination: "/icon.svg",
      },
    ];
  },
};

export default nextConfig;
