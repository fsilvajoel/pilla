import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkBash, decide, run, shellWords, type HookInput } from "./guard-hook.mts";

let repo = "";
let outside = "";

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "guard-repo-"));
  outside = mkdtempSync(join(tmpdir(), "guard-out-"));
  mkdirSync(join(repo, "src"));
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

function tool(toolName: string, toolInput: Record<string, unknown>): HookInput {
  return { toolName, toolInput, cwd: repo };
}

describe("Bash: hooks do git", () => {
  it.each([
    "git commit --no-verify -m 'x'",
    "git -c x=y commit --no-verify -m x",
    "git push --no-verify",
    "git push origin main --no-verif",
    "git commit -n -m x",
    "git commit -an -m x",
    "git commit -anm x",
    "git -C sub commit -n",
    "pnpm verify && git commit -am wip -n",
    "git -c core.hooksPath=/dev/null commit -m x",
    "LEFTHOOK=0 git commit -m x",
  ])("blocks %s", (command) => {
    expect(checkBash(command).allow).toBe(false);
  });

  it.each([
    "git commit -m 'fix -n handling'",
    "git commit -m -n",
    "git commit -am 'msg'",
    "git commit -F msg.txt",
    "git push -n",
    "git log -n 3",
    "echo commit -n",
    "git status",
  ])("allows %s", (command) => {
    expect(checkBash(command)).toEqual({ allow: true });
  });

  it("explains why --no-verify is refused", () => {
    expect(checkBash("git commit --no-verify")).toEqual({
      allow: false,
      reason: "--no-verify é proibido: corrija a causa da falha do hook",
    });
  });
});

describe("Bash: .env", () => {
  it.each(["cat .env", "less ./.env", "grep TOKEN apps/api/.env", "cp .env.local /tmp/x", "cat .env*", "source .env"])(
    "blocks %s",
    (command) => {
      expect(checkBash(command)).toEqual({
        allow: false,
        reason: ".env não pode ser lido nem alterado (use .env.example)",
      });
    },
  );

  it.each(["cat .env.example", "cat apps/api/.env.example", "cat .envrc", "node scripts/check-env-example.mjs"])(
    "allows %s",
    (command) => {
      expect(checkBash(command)).toEqual({ allow: true });
    },
  );
});

describe("file tools", () => {
  it.each(["Read", "Edit", "Write", "MultiEdit"])("%s on .env is blocked", (name) => {
    expect(decide(tool(name, { file_path: join(repo, ".env") }), repo).allow).toBe(false);
  });

  it("MultiEdit on a relative .env.production is blocked", () => {
    expect(decide(tool("MultiEdit", { file_path: "apps/api/.env.production", edits: [] }), repo).allow).toBe(false);
  });

  it("Read of .env.example is allowed", () => {
    expect(decide(tool("Read", { file_path: join(repo, ".env.example") }), repo)).toEqual({ allow: true });
  });

  it("Grep and Glob aimed at .env are blocked", () => {
    expect(decide(tool("Grep", { pattern: "TOKEN", path: join(repo, ".env") }), repo).allow).toBe(false);
    expect(decide(tool("Grep", { pattern: "TOKEN", glob: ".env*" }), repo).allow).toBe(false);
    expect(decide(tool("Glob", { pattern: ".env" }), repo).allow).toBe(false);
  });

  it("writes inside the repo are allowed, outside are blocked", () => {
    expect(decide(tool("Write", { file_path: join(repo, "src", "new", "a.ts") }), repo)).toEqual({ allow: true });
    expect(decide(tool("Write", { file_path: join(outside, "a.ts") }), repo)).toEqual({
      allow: false,
      reason: `escrita fora do repositório: ${join(outside, "a.ts")}`,
    });
    expect(decide(tool("Edit", { file_path: "../escape.ts" }), repo).allow).toBe(false);
    expect(decide(tool("NotebookEdit", { notebook_path: join(outside, "n.ipynb") }), repo).allow).toBe(false);
  });

  it("a symlink inside the repo pointing outside does not allow the write", () => {
    symlinkSync(outside, join(repo, "link"));
    expect(decide(tool("Write", { file_path: join(repo, "link", "a.ts") }), repo).allow).toBe(false);
  });

  it("reading outside the repo is not a write and is allowed", () => {
    expect(decide(tool("Read", { file_path: join(outside, "a.ts") }), repo)).toEqual({ allow: true });
  });
});

describe("run", () => {
  it("fails closed on invalid input", () => {
    expect(run("not json", repo)).toEqual({ code: 2, message: "guard-hook: evento inválido no stdin; bloqueado" });
    expect(run(JSON.stringify({ tool_name: "Bash" }), repo).code).toBe(2);
  });

  it("returns 0 for an allowed event and 2 with the reason for a blocked one", () => {
    const ok = JSON.stringify({ tool_name: "Bash", tool_input: { command: "git status" }, cwd: repo });
    expect(run(ok, repo)).toEqual({ code: 0, message: "" });
    const bad = JSON.stringify({ tool_name: "Bash", tool_input: { command: "cat .env" }, cwd: repo });
    expect(run(bad, repo)).toEqual({
      code: 2,
      message: "guard-hook: .env não pode ser lido nem alterado (use .env.example)",
    });
  });

  it("works as a real process reading stdin", () => {
    const event = JSON.stringify({ tool_name: "Bash", tool_input: { command: "git -c x=y commit --no-verify" } });
    const result = spawnSync("node", [join(import.meta.dirname, "guard-hook.mts")], {
      input: event,
      encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/--no-verify é proibido/);
  });
});

describe("shellWords", () => {
  it("keeps quoted text together and splits control operators", () => {
    expect(shellWords(`git commit -m "a && b" && echo 'x y'`)).toEqual([
      "git",
      "commit",
      "-m",
      "a && b",
      "&&",
      "echo",
      "x y",
    ]);
  });
});
