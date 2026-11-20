import type { INestApplication } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import { configureApp } from "./configure-app";

// Adaptador que não é Express: a configuração do ETag é ignorada sem lançar.
function fakeApp(instance: unknown): INestApplication {
  const app = {
    getHttpAdapter: () => ({ getInstance: () => instance }),
    setGlobalPrefix: () => undefined,
    useGlobalFilters: () => undefined,
    use: () => undefined,
    get: (token: unknown) => (token === HttpAdapterHost ? { httpAdapter: { getRequestUrl: () => "/" } } : undefined),
  };
  return app as unknown as INestApplication;
}

describe("configureApp with a non-Express adapter", () => {
  it("skips the ETag setting when the adapter instance is not a function", () => {
    expect(() => {
      configureApp(fakeApp({}));
    }).not.toThrow();
  });

  it("skips the ETag setting when the instance has no set()", () => {
    expect(() => {
      configureApp(fakeApp(() => undefined));
    }).not.toThrow();
  });

  it("sets etag to false when the instance has set()", () => {
    const calls: unknown[][] = [];
    const instance = Object.assign(() => undefined, {
      set: (...args: unknown[]) => {
        calls.push(args);
      },
    });
    configureApp(fakeApp(instance));
    expect(calls).toEqual([["etag", false]]);
  });
});
