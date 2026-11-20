import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { checkSchemas } from "./check-schemas.mjs";

function src(files) {
  const dir = mkdtempSync(join(tmpdir(), "check-schemas-"));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  return dir;
}
const rules = (dir) => checkSchemas(dir).problems.map((p) => / (S\d) /.exec(p)[1]);
const GOOD = {
  "index.ts": 'export * from "./common";\nexport * from "./api/pay";\nexport { eventV1 } from "./events/envelope";\n',
  "common.ts": "export const cpfSchema = z.string().regex(/^\\d{11}$/);\nexport const centsSchema = z.int();\n",
  "events/envelope.ts": "export const eventV1 = 1;\n",
  "api/pay.ts":
    "export const payRequest = z.strictObject({\n  loanId: idSchema,\n  amountCents: positiveCentsSchema,\n" +
    "  paidAt: isoDateSchema,\n  successorLoanId: idSchema.optional(),\n  rateBps: bpsSchema,\n  cpf: cpfSchema,\n" +
    '  note: z.string().trim().min(1),\n}).refine((p) => p.amountCents > 0, { path: ["amountCents"] });\n',
  "api/pay.test.ts": "const body = { amountCents: 100, loanId: z.string() };\n",
  "api/api.test.ts": 'const cases = [{ name: "payRequest" }];\n',
};

test("clean tree has no problems (tests and common.ts are out of scope)", () => {
  const dir = src(GOOD);
  assert.deepEqual(checkSchemas(dir), { problems: [], files: 4 });
  rmSync(dir, { recursive: true });
});

test("S1: api or events file missing from index.ts", () => {
  const dir = src({ ...GOOD, "events/loan-x.ts": "export const x = z.strictObject({});\n" });
  const { problems } = checkSchemas(dir);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /loan-x\.ts:1 S1 .*export \* from "\.\/events\/loan-x";/);
  rmSync(dir, { recursive: true });
});

test("S2: regex outside common.ts, in every form", () => {
  for (const line of ["  code: z.string().regex(/^a$/),", "const r = new RegExp(x);", "if (/^\\d+$/.test(v)) f();"]) {
    const dir = src({ ...GOOD, "api/pay.ts": GOOD["api/pay.ts"] + line + "\n" });
    assert.deepEqual(rules(dir), ["S2"], line);
    rmSync(dir, { recursive: true });
  }
});

test("S3: suffix fields must use the primitive, even with a comma inside the value", () => {
  const bad = {
    "amountCents: z.int().positive(),": "amountCents",
    'amountCents: z.int().refine((c) => c !== 0, "x"),': "amountCents",
    "loanId: z.string(),": "loanId",
    "dueDate: z.string(),": "dueDate",
    "paidAt: z.iso.date(),": "paidAt",
    "rateBps: z.int(),": "rateBps",
    "cpf: z.string().length(11),": "cpf",
  };
  for (const [line, field] of Object.entries(bad)) {
    const dir = src({ ...GOOD, "api/pay.ts": `export const p = z.strictObject({\n  ${line}\n});\n` });
    const { problems } = checkSchemas(dir);
    assert.equal(problems.length, 1, line);
    assert.match(problems[0], new RegExp(`pay\\.ts:2 S3 campo ${field} `), line);
    rmSync(dir, { recursive: true });
  }
});

test("comment lines are ignored", () => {
  const dir = src({ ...GOOD, "api/pay.ts": "/** amountCents: z.int() and /a/.test(x) */\n// loanId: z.string(),\n" });
  assert.deepEqual(checkSchemas(dir).problems, []);
  rmSync(dir, { recursive: true });
});

test("S4: body schema without a case in api.test.ts", () => {
  const dir = src({ ...GOOD, "api/pay.ts": GOOD["api/pay.ts"] + "export const refundQuery = z.strictObject({});\n" });
  const { problems } = checkSchemas(dir);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /pay\.ts:\d+ S4 refundQuery .*name: "refundQuery"/);
  rmSync(dir, { recursive: true });
});

test("S5: loose objects in api and events", () => {
  for (const line of [
    "const a = z.object({});",
    "const b = z.looseObject({});",
    "const c = x.passthrough();",
    "const d = x.loose();",
  ]) {
    const dir = src({ ...GOOD, "events/envelope.ts": GOOD["events/envelope.ts"] + line + "\n" });
    assert.deepEqual(rules(dir), ["S5"], line);
    rmSync(dir, { recursive: true });
  }
});
