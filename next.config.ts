import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Evita inferir a pasta pai quando existem vários package-lock no workspace
    root: process.cwd(),
  },
};

export default nextConfig;
