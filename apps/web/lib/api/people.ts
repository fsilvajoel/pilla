import { personListResponse, type PersonListResponse } from "@pilla/schemas";
import { apiFetch } from "./client";

export interface ListPeopleParams {
  /** Passado como está para a API (nome ou CPF). */
  search?: string;
  limit?: number;
  cursor?: string;
}

/** GET /people?search=&limit=&cursor= (RF-04). */
export function listPeople(params: ListPeopleParams = {}): Promise<PersonListResponse> {
  return apiFetch({ path: "/people", query: { ...params }, schema: personListResponse });
}
