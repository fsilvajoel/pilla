import { describe, expect, it } from "vitest";
import type { LoanStatus } from "./loan-status";
import { canActivate, canCancel, canEdit, canRenew, canRenegotiate, canWriteOff } from "./loan-transitions";

type Transition = (status: LoanStatus) => boolean;

const ALL_STATUSES: readonly LoanStatus[] = [
  "DRAFT",
  "ACTIVE",
  "RENEWED",
  "RENEGOTIATED",
  "PAID_OFF",
  "WRITTEN_OFF",
  "CANCELLED",
];

function suite(name: string, fn: Transition, allowedFrom: LoanStatus): void {
  describe(name, () => {
    it.each(ALL_STATUSES)("retorna o esperado para %s", (status) => {
      expect(fn(status)).toBe(status === allowedFrom);
    });

    it(`aceita ${allowedFrom}`, () => {
      expect(fn(allowedFrom)).toBe(true);
    });

    it.each(ALL_STATUSES.filter((s) => s !== allowedFrom))("recusa %s", (status) => {
      expect(fn(status)).toBe(false);
    });
  });
}

suite("canEdit", canEdit, "DRAFT");
suite("canCancel", canCancel, "DRAFT");
suite("canActivate", canActivate, "DRAFT");
suite("canRenew", canRenew, "ACTIVE");
suite("canRenegotiate", canRenegotiate, "ACTIVE");
suite("canWriteOff", canWriteOff, "ACTIVE");
