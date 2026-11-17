// Proibições de docs/agents/travas.md §3. Comentários de desligar regra são proibidos (noInlineConfig).
import tseslint from "typescript-eslint";

const testFiles = ["**/*.test.ts", "**/*.spec.ts", "**/*.test.tsx", "**/*.spec.tsx"];
const pureCode = ["packages/finance/src/**/*.ts", "**/domain/**/*.ts"];

const testBans = [
  {
    selector: "MemberExpression[object.name=/^(it|describe|test)$/][property.name=/^(only|skip)$/]",
    message: ".only/.skip desliga teste (travas §3).",
  },
  {
    selector: "CallExpression[callee.name='expect'][arguments.0.type='Literal'][arguments.0.value=true]",
    message: "expect(true) não testa nada (travas §3).",
  },
];
export const commonBans = [{ selector: "ExportDefaultDeclaration", message: "Use export nomeado (travas §3)." }];
const pureBans = [
  { selector: "Literal[raw=/^[0-9]*\\.[0-9]/]", message: "Literal decimal: dinheiro é bigint em centavos (ADR-0004)." },
  { selector: "NewExpression[callee.name='Date']", message: "Relógio deve ser injetado (travas §3)." },
  {
    selector: "MemberExpression[object.name='Date'][property.name='now']",
    message: "Relógio deve ser injetado (travas §3).",
  },
];

export const pillaEslint = tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/reports/**",
      "**/.stryker-tmp/**",
      "**/*.config.*",
      "tools/**",
      "docs/**",
    ],
  },
  { linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "error" } },
  ...tseslint.configs.strictTypeChecked,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      "no-console": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": true, "ts-nocheck": true, "ts-expect-error": true, "ts-check": false },
      ],
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      "no-restricted-syntax": ["error", ...commonBans],
    },
  },
  {
    files: pureCode,
    ignores: testFiles,
    rules: {
      "no-restricted-syntax": ["error", ...commonBans, ...pureBans],
      "no-restricted-globals": [
        "error",
        { name: "parseFloat", message: "Sem ponto flutuante (ADR-0004)." },
        { name: "Number", message: "Sem ponto flutuante (ADR-0004)." },
      ],
      "no-restricted-properties": ["error", { object: "Math", message: "Sem ponto flutuante (ADR-0004)." }],
    },
  },
  {
    files: testFiles,
    rules: {
      "@typescript-eslint/consistent-type-assertions": "off",
      "no-restricted-syntax": ["error", ...commonBans, ...testBans],
    },
  },
);
