import type { NextConfig } from "next";

// Os pacotes do workspace exportam TypeScript puro (src/index.ts); o Next precisa transpilar.
if (process.env.PILLA_AUTH_ENFORCED?.trim() === "false")
  process.stderr.write("WARN: autenticação DESLIGADA, só desenvolvimento\n");

const nextConfig: NextConfig = {
  // Next 16 dev bloqueia origens cruzadas de dev: libera o acesso pela LAN.
  allowedDevOrigins: ["192.168.31.58", "localhost", "127.0.0.1"],
  transpilePackages: ["@pilla/schemas", "@pilla/finance"],
};

export default nextConfig;
