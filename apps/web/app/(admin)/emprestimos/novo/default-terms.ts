import { defaultTermsResponse, type DefaultTermsResponse } from "@pilla/schemas";
import { apiFetch } from "@/lib/api/client";

/**
 * GET /settings/default-terms (RF-40). Lacuna: ainda não há função em lib/api/loans.ts (fora do escopo do E10-T16),
 * então a chamada vive aqui, sobre o mesmo cliente.
 */
export function getDefaultTerms(): Promise<DefaultTermsResponse> {
  return apiFetch({ path: "/settings/default-terms", schema: defaultTermsResponse });
}
