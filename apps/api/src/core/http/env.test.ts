import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { readApiEnv } from "./env";

const databaseUrl = "postgres://u:p@127.0.0.1:5432/pilla";
const portInvalid = "PILLA_API_PORT inválida: informe um inteiro de 1024 a 65535.";
const portMissing = "PILLA_API_PORT ausente: informe um inteiro de 1024 a 65535.";
const urlInvalid = "DATABASE_URL inválida: informe postgres://usuario:senha@host:porta/banco.";
const urlMissing = "DATABASE_URL ausente: informe postgres://usuario:senha@host:porta/banco.";

describe("readApiEnv: PILLA_API_PORT", () => {
  it("lê a porta e fixa o host em 127.0.0.1", () => {
    expect(readApiEnv({ PILLA_API_PORT: "3000", DATABASE_URL: databaseUrl })).toEqual({
      host: "127.0.0.1",
      port: 3000,
      databaseUrl,
    });
  });

  it.each(["1024", "65535"])("aceita o limite %s", (port) => {
    expect(readApiEnv({ PILLA_API_PORT: port, DATABASE_URL: databaseUrl }).port).toBe(Number.parseInt(port, 10));
  });

  it.each(["1023", "65536", "0", "-1", " 3000 ", "3000.0", "3e3", "+3000", "abc", "99999999999999999999"])(
    "rejeita %j",
    (port) => {
      expect(() => readApiEnv({ PILLA_API_PORT: port, DATABASE_URL: databaseUrl })).toThrow(portInvalid);
    },
  );

  it.each([undefined, "", "   "])("rejeita porta ausente (%j)", (port) => {
    expect(() => readApiEnv({ PILLA_API_PORT: port, DATABASE_URL: databaseUrl })).toThrow(portMissing);
  });

  it("aceita todo inteiro da faixa e rejeita os de fora", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1024, max: 65535 }), (n) => {
        expect(readApiEnv({ PILLA_API_PORT: String(n), DATABASE_URL: databaseUrl }).port).toBe(n);
      }),
    );
    fc.assert(
      fc.property(fc.oneof(fc.integer({ min: 0, max: 1023 }), fc.integer({ min: 65536, max: 10_000_000 })), (n) => {
        expect(() => readApiEnv({ PILLA_API_PORT: String(n), DATABASE_URL: databaseUrl })).toThrow(portInvalid);
      }),
    );
  });
});

describe("readApiEnv: DATABASE_URL", () => {
  it.each([databaseUrl, "postgresql://u:p@db:5432/pilla"])("aceita e devolve %s igual", (url) => {
    expect(readApiEnv({ PILLA_API_PORT: "3000", DATABASE_URL: url }).databaseUrl).toBe(url);
  });

  it.each([
    "localhost:5432",
    "mysql://u:p@h:3306/db",
    "postgres://u:p@h:abc/db",
    "postgres://u:p@h:5432",
    "postgres://u:p@:5432/db",
    " postgres://u:p@h:5432/db ",
  ])("rejeita %j", (url) => {
    expect(() => readApiEnv({ PILLA_API_PORT: "3000", DATABASE_URL: url })).toThrow(urlInvalid);
  });

  it.each([undefined, "", "   "])("rejeita URL ausente (%j)", (url) => {
    expect(() => readApiEnv({ PILLA_API_PORT: "3000", DATABASE_URL: url })).toThrow(urlMissing);
  });

  it("nunca põe a senha na mensagem de erro", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z0-9_-]{8,24}$/), (senha) => {
        const url = `postgres://u:${senha}@h:abc/db`;
        expect(() => readApiEnv({ PILLA_API_PORT: "3000", DATABASE_URL: url })).toThrow(urlInvalid);
        try {
          readApiEnv({ PILLA_API_PORT: "3000", DATABASE_URL: url });
        } catch (error: unknown) {
          expect(error instanceof Error ? error.message : "").not.toContain(senha);
        }
      }),
    );
  });
});
