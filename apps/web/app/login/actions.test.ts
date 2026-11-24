// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiProblem } from "@/lib/api/problem";

const redirect = vi.fn((url: string): never => {
  throw new Error(`redirect:${url}`);
});
const loginAdmin = vi.fn();
const writeSessionToken = vi.fn();
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/api/auth", () => ({ loginAdmin }));
vi.mock("@/lib/api/session", async () => {
  const real = await vi.importActual<typeof import("@/lib/api/session")>("@/lib/api/session");
  return { ...real, writeSessionToken };
});

const { loginAction } = await import("./actions");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}
const FILLED = { username: "joel", password: "segredo" };

beforeEach(() => {
  redirect.mockClear();
  loginAdmin.mockReset();
  writeSessionToken.mockReset();
});

describe("loginAction", () => {
  it("campos vazios não chamam a API", async () => {
    expect(await loginAction({ error: null }, form({ username: "", password: "" }))).toEqual({
      error: "Usuário ou senha inválidos.",
    });
    expect(loginAdmin).not.toHaveBeenCalled();
  });

  it("401 e 429 têm mensagens próprias; o resto é indisponibilidade", async () => {
    loginAdmin.mockRejectedValueOnce(new ApiProblem(401, null));
    expect((await loginAction({ error: null }, form(FILLED))).error).toBe("Usuário ou senha inválidos.");
    loginAdmin.mockRejectedValueOnce(new ApiProblem(429, null));
    expect((await loginAction({ error: null }, form(FILLED))).error).toBe("Muitas tentativas. Aguarde um minuto.");
    loginAdmin.mockRejectedValueOnce(new Error("rede"));
    expect((await loginAction({ error: null }, form(FILLED))).error).toBe(
      "Não foi possível entrar agora. Tente novamente.",
    );
    expect(writeSessionToken).not.toHaveBeenCalled();
  });

  it("sucesso grava o cookie e vai para o next interno", async () => {
    loginAdmin.mockResolvedValue({ admin: {}, token: "abc" });
    await expect(loginAction({ error: null }, form({ ...FILLED, next: "/pessoas" }))).rejects.toThrow(
      "redirect:/pessoas",
    );
    expect(writeSessionToken).toHaveBeenCalledWith("abc");
  });

  it("next externo vai para /", async () => {
    loginAdmin.mockResolvedValue({ admin: {}, token: "abc" });
    await expect(loginAction({ error: null }, form({ ...FILLED, next: "//evil.com" }))).rejects.toThrow("redirect:/");
  });
});
