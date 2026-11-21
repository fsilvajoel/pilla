// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateLoanRequest } from "@pilla/schemas";
import { ApiProblem } from "./problem";
import {
  activateLoan,
  cancelLoan,
  createLoanDraft,
  getLoan,
  getPayoffQuote,
  listAccounts,
  listLoans,
  renegotiateLoan,
  renewLoan,
  updateLoan,
  writeOffLoan,
} from "./loans";

const ID = "01890a5d-ac96-774b-bcce-b302099a8057";
const draft = {
  id: ID,
  loanNumber: "2026-0001",
  personId: ID,
  type: "INSTALLMENT",
  status: "DRAFT",
  principalCents: 100000,
  monthlyInterestRateBps: 500,
  installmentCount: 3,
  frequency: { unit: "MONTH", interval: 1 },
  firstDueDate: "2026-12-20",
  contractedAt: "2026-11-20",
  accountId: null,
  lateFeeBps: 200,
  lateInterestMonthlyBps: 100,
  gracePeriodDays: 0,
  roundingStepCents: 1,
  disbursedAt: null,
  version: 2,
};

const createBody: CreateLoanRequest = {
  personId: ID,
  type: "INSTALLMENT",
  principalCents: 100000,
  monthlyInterestRateBps: 500,
  installmentCount: 3,
  frequency: { unit: "MONTH", interval: 1 },
  firstDueDate: "2026-12-20",
  lateFeeBps: 200,
  lateInterestMonthlyBps: 100,
  gracePeriodDays: 0,
};

const fetchMock = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>();

function respond(body: unknown, status = 200): void {
  fetchMock.mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })),
  );
}

function last(): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error("fetch não chamado");
  return { url: call[0].toString(), init: call[1] };
}

beforeEach(() => {
  vi.stubEnv("PILLA_API_URL", "http://api.test");
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("lending client", () => {
  it("listLoans manda filtros na query", async () => {
    respond({ items: [], nextCursor: null });
    await listLoans({ status: "ACTIVE", standing: "OVERDUE", limit: 10 });
    expect(last().url).toBe("http://api.test/loans?status=ACTIVE&standing=OVERDUE&limit=10");
  });

  it("getLoan propaga 404 como ApiProblem", async () => {
    respond({ type: "x", title: "Não encontrado", status: 404, code: "NOT_FOUND" }, 404);
    const err: unknown = await getLoan(ID).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiProblem);
  });

  it("createLoanDraft valida o aviso RN-C11", async () => {
    respond({ ...draft, warning: { activeLoansCount: 1 } }, 201);
    const res = await createLoanDraft(createBody);
    expect(res.warning.activeLoansCount).toBe(1);
    expect(last().init.method).toBe("POST");
  });

  it("updateLoan, cancelLoan e activateLoan mandam If-Match com a versão", async () => {
    respond(draft);
    await updateLoan(ID, 2, { gracePeriodDays: 1 });
    expect(last().init.method).toBe("PATCH");
    expect(last().init.headers).toMatchObject({ "if-match": "2" });
    await cancelLoan(ID, 3);
    expect(last().url).toBe(`http://api.test/loans/${ID}/cancel`);
    expect(last().init.headers).toMatchObject({ "if-match": "3" });
    await activateLoan(ID, 4, { disbursedAt: "2026-11-20", accountId: ID });
    expect(last().init.headers).toMatchObject({ "if-match": "4" });
    expect(last().init.body).toBe(JSON.stringify({ disbursedAt: "2026-11-20", accountId: ID }));
  });

  it("renewLoan, renegotiateLoan e writeOffLoan chamam as rotas de transição", async () => {
    respond({ ...draft, originLoanId: ID, originType: "RENEWAL", capitalizedAmountCents: 0 });
    const renewed = await renewLoan(ID, { firstDueDate: "2026-12-20" });
    expect(renewed.capitalizedAmountCents).toBe(0);
    expect(last().url).toBe(`http://api.test/loans/${ID}/renew`);
    await renegotiateLoan(ID, { firstDueDate: "2026-12-20" });
    expect(last().url).toBe(`http://api.test/loans/${ID}/renegotiate`);
    respond(draft);
    await writeOffLoan(ID, 5, { reason: "Perda" });
    expect(last().url).toBe(`http://api.test/loans/${ID}/write-off`);
    expect(last().init.headers).toMatchObject({ "if-match": "5" });
  });

  it("resposta fora do schema vira ApiProblem", async () => {
    respond({ id: "x" });
    const err: unknown = await cancelLoan(ID, 1).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiProblem);
  });

  it("getPayoffQuote e listAccounts", async () => {
    respond({ date: "2026-11-20", amountCents: 3, principalCents: 1, interestCents: 1, lateChargesCents: 1 });
    await getPayoffQuote(ID, "2026-11-20");
    expect(last().url).toBe(`http://api.test/loans/${ID}/payoff-quote?date=2026-11-20`);
    respond({ items: [{ id: ID, name: "Caixa", active: true }] });
    expect((await listAccounts()).items).toHaveLength(1);
    expect(last().url).toBe("http://api.test/accounts");
  });
});
