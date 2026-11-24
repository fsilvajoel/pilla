import { describe, expect, it } from "vitest";
import { portalAccessResponse, setPortalAccessRequest } from "./portal-access";

const PERSON = "0190f3a2-7b1c-7d4e-8a5b-1c2d3e4f5a6b";

describe("setPortalAccessRequest", () => {
  it.each([true, false])("A5: accepts enabled %s", (enabled) => {
    expect(setPortalAccessRequest.safeParse({ enabled }).success).toBe(true);
  });

  it.each([
    ["a string", { enabled: "true" }],
    ["a number", { enabled: 0 }],
    ["a missing key", {}],
    ["an extra key", { enabled: true, personId: PERSON }],
  ])("A5: rejects %s", (_name, body) => {
    expect(setPortalAccessRequest.safeParse(body).success).toBe(false);
  });
});

describe("portalAccessResponse", () => {
  it("A5: accepts an instant", () => {
    const body = { personId: PERSON, enabled: true, enabledAt: "2026-11-23T12:00:00-03:00" };
    expect(portalAccessResponse.safeParse(body).success).toBe(true);
  });

  it("A5: accepts enabledAt null", () => {
    expect(portalAccessResponse.safeParse({ personId: PERSON, enabled: false, enabledAt: null }).success).toBe(true);
  });

  it.each([
    ["a date without time", { personId: PERSON, enabled: true, enabledAt: "2026-11-23" }],
    ["a bad person id", { personId: "x", enabled: true, enabledAt: null }],
    ["a missing enabledAt", { personId: PERSON, enabled: true }],
    ["an extra key", { personId: PERSON, enabled: true, enabledAt: null, enabledBy: PERSON }],
  ])("A5: rejects %s", (_name, body) => {
    expect(portalAccessResponse.safeParse(body).success).toBe(false);
  });
});
