// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("./client", () => client);

import { getDashboardToday } from "./dashboard";
import {
  confirmPayment,
  createPayment,
  listPayments,
  previewAllocation,
  rejectPayment,
  reversePayment,
} from "./payments";

const ID = "01890a5d-ac96-774b-bcce-b302099a8057";

function lastOptions(): Record<string, unknown> {
  const call = client.apiFetch.mock.calls.at(-1) as [Record<string, unknown>] | undefined;
  if (!call) throw new Error("apiFetch não chamado");
  return call[0];
}

beforeEach(() => {
  client.apiFetch.mockReset();
  client.apiFetch.mockResolvedValue({ ok: true });
});

describe("payments client", () => {
  it("previewAllocation faz POST na prévia com o corpo", async () => {
    const body = { loanId: ID, amountCents: 1000 };
    await previewAllocation(body as never);
    expect(lastOptions()).toMatchObject({ method: "POST", path: "/payments/allocation-preview", body });
  });

  it("createPayment manda a Idempotency-Key", async () => {
    const body = { loanId: ID };
    expect(await createPayment(body as never, "chave-1")).toEqual({ ok: true });
    expect(lastOptions()).toMatchObject({
      method: "POST",
      path: "/payments",
      body,
      headers: { "idempotency-key": "chave-1" },
    });
  });

  it("listPayments repassa os filtros na query e aceita chamada sem parâmetros", async () => {
    await listPayments({ status: "PENDING_REVIEW", limit: 10 });
    expect(lastOptions()).toMatchObject({ path: "/payments", query: { status: "PENDING_REVIEW", limit: 10 } });
    await listPayments();
    expect(lastOptions()).toMatchObject({ path: "/payments", query: {} });
  });

  it("confirm, reject e reverse levam a versão em If-Match", async () => {
    await confirmPayment(ID, 3);
    expect(lastOptions()).toMatchObject({
      method: "POST",
      path: `/payments/${ID}/confirm`,
      body: {},
      headers: { "if-match": "3" },
    });
    await rejectPayment(ID, 4, { reason: "Valor errado" });
    expect(lastOptions()).toMatchObject({
      path: `/payments/${ID}/reject`,
      body: { reason: "Valor errado" },
      headers: { "if-match": "4" },
    });
    await reversePayment(ID, 5, { reason: "Duplicado" });
    expect(lastOptions()).toMatchObject({
      path: `/payments/${ID}/reverse`,
      body: { reason: "Duplicado" },
      headers: { "if-match": "5" },
    });
  });
});

describe("dashboard client", () => {
  it("getDashboardToday chama GET /dashboard/today", async () => {
    expect(await getDashboardToday()).toEqual({ ok: true });
    expect(lastOptions()).toMatchObject({ path: "/dashboard/today" });
    expect(lastOptions().method).toBeUndefined();
  });
});
