import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// O db:regen refaz só a pasta do módulo pedido: gerar um módulo não pode apagar a migração nova de outro.
describe("db:regen (RFC-005 §8)", () => {
  const dryRun = (...args: string[]) =>
    spawnSync("node", ["scripts/db-regen.mjs", ...args, "--dry-run"], { encoding: "utf8" });

  it("restores and cleans only the folder of the given module", () => {
    const r = dryRun("x", "treasury");
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("git checkout -- migrations/treasury\ngit clean -fdq migrations/treasury\n");
  });

  it("uses core when no module is given", () => {
    expect(dryRun("x").stdout).toBe("git checkout -- migrations/core\ngit clean -fdq migrations/core\n");
  });

  it("refuses a call without the migration name", () => {
    expect(dryRun().status).toBe(2);
  });
});
