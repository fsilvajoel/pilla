import type { NextConfig } from "next";

// Os pacotes do workspace exportam TypeScript puro (src/index.ts); o Next precisa transpilar.
const nextConfig: NextConfig = {
  transpilePackages: ["@pilla/schemas", "@pilla/finance"],
};

export default nextConfig;
