// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addAddress,
  addPixKey,
  createPerson,
  deleteAddress,
  deletePixKey,
  getPerson,
  listPeople,
  updateAddress,
  updatePerson,
  updatePixKey,
} from "./people";

const PERSON_ID = "01936f8e-7b2c-7cde-8f00-000000000001";
const OTHER_ID = "01936f8e-7b2c-7cde-8f00-000000000002";
const ADDRESS_ID = "01936f8e-7b2c-7cde-8f00-000000000003";
const PIX_ID = "01936f8e-7b2c-7cde-8f00-000000000004";

const summary = { id: OTHER_ID, fullName: "Bruno Lima", cpf: null, phone: "+5511987654302", active: true };
const person = {
  id: PERSON_ID,
  fullName: "Ana Costa",
  cpf: "52998224725",
  phone: "+5511987654321",
  active: true,
  version: 1,
};
const address = {
  id: ADDRESS_ID,
  street: "Rua das Flores",
  number: "123",
  district: "Centro",
  city: "São Paulo",
  state: "SP",
  postalCode: "01001000",
  isPrimary: true,
};
const pixKey = { id: PIX_ID, type: "EMAIL", value: "ana@example.com", isPrimary: true };
const addressRequest = {
  street: "Rua das Flores",
  number: "123",
  district: "Centro",
  city: "São Paulo",
  state: "SP",
  postalCode: "01001000",
};

describe("people data layer", () => {
  const fetchMock = vi.fn<typeof fetch>();

  function answer(status: number, body: unknown): void {
    fetchMock.mockResolvedValue(new Response(body === null ? null : JSON.stringify(body), { status }));
  }

  function lastCall(): { url: string; method: string | undefined; body: unknown } {
    const call = fetchMock.mock.calls[0];
    const body = call?.[1]?.body;
    return {
      url: call?.[0] instanceof URL ? call[0].href : "",
      method: call?.[1]?.method,
      body: typeof body === "string" ? body : null,
    };
  }

  beforeEach(() => {
    vi.stubEnv("PILLA_API_URL", "http://api.test/api/v1");
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("lists people with search and limit", async () => {
    answer(200, { items: [summary], nextCursor: null });

    expect((await listPeople({ search: "bruno", limit: 5 })).items).toHaveLength(1);
    expect(lastCall().url).toBe("http://api.test/api/v1/people?search=bruno&limit=5");
  });

  it("lists people without parameters", async () => {
    answer(200, { items: [], nextCursor: null });

    await listPeople();

    expect(lastCall().url).toBe("http://api.test/api/v1/people");
  });

  it("reads the full sheet with referrer, referrals, addresses and PIX keys", async () => {
    answer(200, {
      ...person,
      referrer: summary,
      referrals: [summary],
      addresses: [address],
      pixKeys: [pixKey],
    });

    const sheet = await getPerson(PERSON_ID);

    expect(lastCall().url).toBe(`http://api.test/api/v1/people/${PERSON_ID}`);
    expect(sheet.referrer?.fullName).toBe("Bruno Lima");
    expect(sheet.referrals).toHaveLength(1);
    expect(sheet.addresses[0]?.street).toBe("Rua das Flores");
    expect(sheet.pixKeys[0]?.type).toBe("EMAIL");
  });

  it("accepts a sheet of a person without CPF", async () => {
    answer(200, { ...person, cpf: null, referrer: null, referrals: [], addresses: [], pixKeys: [] });

    expect((await getPerson(PERSON_ID)).cpf).toBeNull();
  });

  it("creates and updates a person", async () => {
    answer(201, person);
    await createPerson({ fullName: "Ana Costa", cpf: "52998224725", phone: "11987654321" });
    expect(lastCall()).toMatchObject({ url: "http://api.test/api/v1/people", method: "POST" });

    fetchMock.mockReset();
    answer(200, person);
    await updatePerson(PERSON_ID, { version: 1, phone: "11987654322" });
    expect(lastCall()).toMatchObject({ url: `http://api.test/api/v1/people/${PERSON_ID}`, method: "PATCH" });
  });

  it("adds, updates and deletes an address", async () => {
    answer(201, address);
    expect((await addAddress(PERSON_ID, addressRequest)).id).toBe(ADDRESS_ID);
    expect(lastCall()).toMatchObject({ url: `http://api.test/api/v1/people/${PERSON_ID}/addresses`, method: "POST" });

    fetchMock.mockReset();
    answer(200, address);
    await updateAddress(ADDRESS_ID, { isPrimary: true });
    expect(lastCall()).toMatchObject({ url: `http://api.test/api/v1/addresses/${ADDRESS_ID}`, method: "PATCH" });

    fetchMock.mockReset();
    answer(204, null);
    expect(await deleteAddress(ADDRESS_ID)).toBeNull();
    expect(lastCall()).toMatchObject({ url: `http://api.test/api/v1/addresses/${ADDRESS_ID}`, method: "DELETE" });
  });

  it("adds, updates and deletes a PIX key", async () => {
    answer(201, pixKey);
    expect((await addPixKey(PERSON_ID, { type: "EMAIL", value: "ana@example.com" })).id).toBe(PIX_ID);
    expect(lastCall()).toMatchObject({ url: `http://api.test/api/v1/people/${PERSON_ID}/pix-keys`, method: "POST" });

    fetchMock.mockReset();
    answer(200, pixKey);
    await updatePixKey(PIX_ID, { isPrimary: true });
    expect(lastCall()).toMatchObject({ url: `http://api.test/api/v1/pix-keys/${PIX_ID}`, method: "PATCH" });

    fetchMock.mockReset();
    answer(204, null);
    expect(await deletePixKey(PIX_ID)).toBeNull();
    expect(lastCall()).toMatchObject({ url: `http://api.test/api/v1/pix-keys/${PIX_ID}`, method: "DELETE" });
  });
});
