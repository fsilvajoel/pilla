import type { NextConfig } from "next";

// Os pacotes do workspace exportam TypeScript puro (src/index.ts); o Next precisa transpilar.
// NEXT_DIST_DIR permite um segundo `next dev` no mesmo diretório (ex.: apontado para a API real) sem brigar pelo .next.
const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["@pilla/schemas", "@pilla/finance"],
};

export default nextConfig;
