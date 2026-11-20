import { describe, it, expect } from "vitest";
import { readApiEnv } from "./env";
import { fc } from "@fast-check/vitest";

describe("readApiEnv (A1, A2)", () => {
  const validDatabaseUrl = "postgres://u:p@127.0.0.1:5432/pilla";

  describe("PILLA_API_PORT (A1)", () => {
    it("C1 (A1, unit): aceita 3000, 1024, 65535", () => {
      expect(readApiEnv({ PILLA_API_PORT: "3000", DATABASE_URL: validDatabaseUrl })).toEqual({
        host: "127.0.0.1",
        port: 3000,
        databaseUrl: validDatabaseUrl,
      });
      expect(readApiEnv({ PILLA_API_PORT: "1024", DATABASE_URL: validDatabaseUrl })).toEqual({
        host: "127.0.0.1",
        port: 1024,
        databaseUrl: validDatabaseUrl,
      });
      expect(readApiEnv({ PILLA_API_PORT: "65535", DATABASE_URL: validDatabaseUrl })).toEqual({
        host: "127.0.0.1",
        port: 65535,
        databaseUrl: validDatabaseUrl,
      });
    });

    it("C2 (A1, unit): rejeita fora da faixa e formatos inválidos", () => {
      const invalidPorts = [
        "1023",
        "65536",
        "0",
        "-1",
        " 3000 ",
        "3000.0",
        "3e3",
        "+3000",
        "abc",
        "99999999999999999999",
      ];
      for (const port of invalidPorts) {
        expect(() => readApiEnv({ PILLA_API_PORT: port, DATABASE_URL: validDatabaseUrl })).toThrow(
          "PILLA_API_PORT inválida: informe um inteiro de 1024 a 65535.",
        );
      }
    });

    it("C3 (A1, unit): rejeita ausente, vazio e só espaços", () => {
      const missingPorts = [undefined, "", "   "];
      for (const port of missingPorts) {
        const env = { DATABASE_URL: validDatabaseUrl } as Record<string, string | undefined>;
        if (port !== undefined) env.PILLA_API_PORT = port;
        expect(() => readApiEnv(env)).toThrow("PILLA_API_PORT ausente: informe um inteiro de 1024 a 65535.");
      }
    });

    it("C4 (A1, prop): todo inteiro 1024-65535 aceito, fora rejeitado", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1024, max: 65535 }), (n) => {
          const result = readApiEnv({ PILLA_API_PORT: String(n), DATABASE_URL: validDatabaseUrl });
          expect(result.port).toBe(n);
        }),
      );
      fc.assert(
        fc.property(fc.integer({ min: -10000, max: 1023 }), (n) => {
          expect(() => readApiEnv({ PILLA_API_PORT: String(n), DATABASE_URL: validDatabaseUrl })).toThrow(
            "PILLA_API_PORT inválida: informe um inteiro de 1024 a 65535.",
          );
        }),
      );
      fc.assert(
        fc.property(fc.integer({ min: 65536, max: 100000 }), (n) => {
          expect(() => readApiEnv({ PILLA_API_PORT: String(n), DATABASE_URL: validDatabaseUrl })).toThrow(
            "PILLA_API_PORT inválida: informe um inteiro de 1024 a 65535.",
          );
        }),
      );
    });
  });

  describe("DATABASE_URL (A2)", () => {
    const validPort = "3000";

    it("C5 (A2, unit): aceita postgres:// e postgresql:// válidas", () => {
      const urls = ["postgres://u:p@127.0.0.1:5432/pilla", "postgresql://u:p@db:5432/pilla"];
      for (const url of urls) {
        expect(readApiEnv({ PILLA_API_PORT: validPort, DATABASE_URL: url })).toEqual({
          host: "127.0.0.1",
          port: 3000,
          databaseUrl: url,
        });
      }
    });

    it("C6 (A2, unit): rejeita formatos inválidos", () => {
      const invalidUrls = [
        "localhost:5432",
        "mysql://u:p@h:3306/db",
        "postgres://u:p@h:abc/db",
        "postgres://u:p@h:5432",
        "postgres://u:p@:5432/db",
        " postgres://u:p@h:5432/db ",
      ];
      for (const url of invalidUrls) {
        expect(() => readApiEnv({ PILLA_API_PORT: validPort, DATABASE_URL: url })).toThrow(
          "DATABASE_URL inválida: informe postgres://usuario:senha@host:porta/banco.",
        );
      }
      const missingUrls = [undefined, "", "   "];
      for (const url of missingUrls) {
        const env = { PILLA_API_PORT: validPort } as Record<string, string | undefined>;
        if (url !== undefined) env.DATABASE_URL = url;
        expect(() => readApiEnv(env)).toThrow(
          "DATABASE_URL ausente: informe postgres://usuario:senha@host:porta/banco.",
        );
      }
    });

    it("C7 (A2, prop): senha nunca aparece na mensagem de erro", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !/[:@/?#%\s]/.test(s)),
          (password) => {
            const url = `postgres://u:${password}@h:5432/db`;
            try {
              readApiEnv({ PILLA_API_PORT: validPort, DATABASE_URL: url });
            } catch (e) {
              const msg = (e as Error).message;
              expect(msg).not.toContain(password);
            }
          },
        ),
      );
    });
  });
});
