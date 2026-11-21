import { defaultTermsResponse, type DefaultTermsResponse, type UpdateDefaultTermsRequest } from "@pilla/schemas";
import { apiFetch } from "./client";

/** GET /settings/default-terms: parâmetros padrão vigentes (RF-40). */
export function getDefaultTerms(): Promise<DefaultTermsResponse> {
  return apiFetch({ path: "/settings/default-terms", schema: defaultTermsResponse });
}

/** PUT /settings/default-terms: nova vigência; só vale para contratos criados depois (E13 D5, D6). */
export function updateDefaultTerms(body: UpdateDefaultTermsRequest): Promise<DefaultTermsResponse> {
  return apiFetch({ method: "PUT", path: "/settings/default-terms", body, schema: defaultTermsResponse });
}
