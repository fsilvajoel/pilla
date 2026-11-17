/** Fronteiras de arquitetura (docs/agents/travas.md §4). Regra quebrada = CI vermelho. */
module.exports = {
  forbidden: [
    { name: "no-circular", severity: "error", comment: "sem ciclos de importação", from: {}, to: { circular: true } },
    {
      name: "module-public-only",
      severity: "error",
      comment: "um módulo só importa de outro pelo public/",
      from: { path: "^apps/[^/]+/src/modules/([^/]+)/" },
      to: {
        path: "^apps/[^/]+/src/modules/([^/]+)/",
        pathNot: ["^apps/[^/]+/src/modules/$1/", "^apps/[^/]+/src/modules/[^/]+/public/"],
      },
    },
    {
      name: "domain-is-pure",
      severity: "error",
      comment: "domain/ não importa framework nem infraestrutura",
      from: { path: "/domain/" },
      to: {
        path: [
          "node_modules/(@nestjs|drizzle-orm|pg|pg-boss|@aws-sdk|zod|nestjs-zod)/",
          "^(@nestjs/[^/]+|drizzle-orm|pg|pg-boss|@aws-sdk/[^/]+|zod|nestjs-zod)(/|$)",
          "/(infra|http)/",
        ],
      },
    },
    {
      name: "finance-is-standalone",
      severity: "error",
      comment: "packages/finance não importa nada do projeto nem bibliotecas externas",
      from: { path: "^packages/finance/src/", pathNot: "\\.test\\.ts$" },
      to: { pathNot: ["^packages/finance/src/"], dependencyTypesNot: ["core"] },
    },
    {
      name: "web-not-api",
      severity: "error",
      comment: "apps/web não importa de apps/api (só packages/*)",
      from: { path: "^apps/web/" },
      to: { path: "^apps/(api|worker)/" },
    },
    {
      name: "web-no-database",
      severity: "error",
      comment: "apps/web não acessa banco: fala só com a API (RFC-003 §4.4)",
      from: { path: "^apps/web/" },
      to: {
        path: [
          "node_modules/(drizzle-orm|drizzle-kit|@electric-sql/pglite|pg|pg-boss|postgres)/",
          "^(drizzle-orm|drizzle-kit|@electric-sql/pglite|pg|pg-boss|postgres)(/|$)",
        ],
      },
    },
    {
      name: "packages-not-apps",
      severity: "error",
      comment: "packages/* nunca importa de apps/*",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.depcruise.json" },
    exclude: { path: ["dist/", "coverage/", "reports/", "\\.stryker-tmp/", "\\.next/"] },
  },
};
