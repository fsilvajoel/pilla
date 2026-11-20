import {
  addressSchema,
  personDetailResponse,
  personResponse,
  personListResponse,
  pixKeySchema,
  type Address,
  type CreateAddressRequest,
  type CreatePersonRequest,
  type CreatePixKeyRequest,
  type PersonDetailResponse,
  type PersonListResponse,
  type PersonResponse,
  type PixKey,
  type UpdateAddressRequest,
  type UpdatePersonRequest,
  type UpdatePixKeyRequest,
} from "@pilla/schemas";
import { z } from "zod";
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

/** GET /people/{id} (RF-04). 404 chega como `ApiProblem` com `status === 404`. */
export function getPerson(id: string): Promise<PersonDetailResponse> {
  return apiFetch({ path: `/people/${id}`, schema: personDetailResponse });
}

/** POST /people (RF-01). */
export function createPerson(body: CreatePersonRequest): Promise<PersonResponse> {
  return apiFetch({ method: "POST", path: "/people", body, schema: personResponse });
}

/** PATCH /people/{id} (RF-01); `body.version` obrigatório (VERSION_CONFLICT em 409). */
export function updatePerson(id: string, body: UpdatePersonRequest): Promise<PersonResponse> {
  return apiFetch({ method: "PATCH", path: `/people/${id}`, body, schema: personResponse });
}

/** POST /people/{personId}/addresses (RF-02). */
export function addAddress(personId: string, body: CreateAddressRequest): Promise<Address> {
  return apiFetch({ method: "POST", path: `/people/${personId}/addresses`, body, schema: addressSchema });
}

/** PATCH /addresses/{id} (RF-02). */
export function updateAddress(id: string, body: UpdateAddressRequest): Promise<Address> {
  return apiFetch({ method: "PATCH", path: `/addresses/${id}`, body, schema: addressSchema });
}

/** DELETE /addresses/{id} (RF-02). */
export function deleteAddress(id: string): Promise<null> {
  return apiFetch({ method: "DELETE", path: `/addresses/${id}`, schema: z.null() });
}

/** POST /people/{personId}/pix-keys (RF-02). */
export function addPixKey(personId: string, body: CreatePixKeyRequest): Promise<PixKey> {
  return apiFetch({ method: "POST", path: `/people/${personId}/pix-keys`, body, schema: pixKeySchema });
}

/** PATCH /pix-keys/{id} (RF-02). */
export function updatePixKey(id: string, body: UpdatePixKeyRequest): Promise<PixKey> {
  return apiFetch({ method: "PATCH", path: `/pix-keys/${id}`, body, schema: pixKeySchema });
}

/** DELETE /pix-keys/{id} (RF-02). */
export function deletePixKey(id: string): Promise<null> {
  return apiFetch({ method: "DELETE", path: `/pix-keys/${id}`, schema: z.null() });
}
