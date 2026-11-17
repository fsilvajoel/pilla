// Regras do repositório (packages/config, travas §3) + Next.js e React Hooks. Nada aqui afrouxa as travas,
// exceto o export default que o próprio Next exige nos arquivos especiais do App Router.
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import { commonBans, pillaEslint } from "@pilla/config/eslint";

// Arquivos que o Next só reconhece pelo export default (convenção de arquivos do App Router).
const nextSpecialFiles = [
  "app/**/{page,layout,template,loading,error,global-error,not-found,forbidden,unauthorized,default}.tsx",
];

// Mesmas proibições comuns, menos a de export default. Só a gravidade ("error" sem opções) herdaria as
// opções do bloco anterior, então lista vazia vira "off" (hoje commonBans só tem o export default).
const nextBans = commonBans.filter((ban) => ban.selector !== "ExportDefaultDeclaration");

export default [
  { ignores: [".next/**", "next-env.d.ts"] },
  ...pillaEslint,
  nextPlugin.configs["core-web-vitals"],
  // Raiz do app explícita: o lint também roda a partir da raiz do monorepo (lefthook).
  { settings: { next: { rootDir: new URL(".", import.meta.url).pathname } } },
  reactHooks.configs.flat.recommended,
  {
    files: nextSpecialFiles,
    rules: {
      "no-restricted-syntax": nextBans.length > 0 ? ["error", ...nextBans] : "off",
    },
  },
];
