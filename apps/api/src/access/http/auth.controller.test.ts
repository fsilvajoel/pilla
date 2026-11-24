import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../db/database";
import { AuthController } from "./auth.controller";

// Logout e me chamados direto, sem cookie: pelo HTTP o guard global responde 401 antes de chegar aqui (E14 D7),
// mas o controller continua correto se for montado sem o guard. Sem cookie o banco nunca é tocado.
const noDb = {} as Database;

describe("AuthController without a session cookie", () => {
  it("logout still expires the cookie and does not touch the database", async () => {
    const setHeader = vi.fn();
    await new AuthController(noDb).logout(undefined, { setHeader });
    expect(setHeader).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("pilla_session=;"));
  });

  it("me gives UNAUTHENTICATED", async () => {
    await expect(new AuthController(noDb).me(undefined)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});
