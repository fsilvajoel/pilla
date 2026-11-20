import type { INestApplication } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { configureApp } from "./configure-app";

type Spy = ReturnType<typeof vi.fn>;

function fakeApp(instance: unknown, spies: { prefix: Spy; filters: Spy; use: Spy }): INestApplication {
  const app: unknown = {
    getHttpAdapter: () => ({ getInstance: () => instance }),
    setGlobalPrefix: spies.prefix,
    useGlobalFilters: spies.filters,
    use: spies.use,
    get: () => ({ httpAdapter: {} }),
  };
  return app as INestApplication;
}

describe("configureApp com adaptador HTTP atípico", () => {
  it("instância que não é função: configura prefixo e filtro sem tentar desligar o ETag", () => {
    const spies = { prefix: vi.fn(), filters: vi.fn(), use: vi.fn() };
    configureApp(fakeApp({}, spies));
    expect(spies.prefix).toHaveBeenCalledWith("api/v1");
    expect(spies.filters).toHaveBeenCalledTimes(1);
    expect(spies.use).toHaveBeenCalledTimes(1);
  });

  it("função sem método set: ignora o ETag e segue configurando", () => {
    const spies = { prefix: vi.fn(), filters: vi.fn(), use: vi.fn() };
    configureApp(fakeApp(() => undefined, spies));
    expect(spies.prefix).toHaveBeenCalledWith("api/v1");
    expect(spies.use).toHaveBeenCalledTimes(1);
  });

  it("função com set: desliga o ETag", () => {
    const spies = { prefix: vi.fn(), filters: vi.fn(), use: vi.fn() };
    const set = vi.fn();
    const instance = Object.assign(() => undefined, { set });
    configureApp(fakeApp(instance, spies));
    expect(set).toHaveBeenCalledWith("etag", false);
  });
});
