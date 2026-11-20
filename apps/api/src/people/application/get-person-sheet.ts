import { cpfSchema, pixKeyTypeSchema, type Address, type PersonDetailResponse, type PixKey } from "@pilla/schemas";
import type { Database } from "../../db/database";
import { findPersonSheet, type PersonSheetRows } from "../infra/person-sheet";
import type { AddressRow, PixKeyRow } from "../infra/schema";

function toAddress(row: AddressRow): Address {
  return {
    id: row.id,
    street: row.street,
    number: row.number,
    ...(row.complement === null ? {} : { complement: row.complement }),
    district: row.district,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    isPrimary: row.isPrimary,
  };
}

function toPixKey(row: PixKeyRow): PixKey {
  return { id: row.id, type: pixKeyTypeSchema.parse(row.type), value: row.value, isPrimary: row.isPrimary };
}

function toSheet(rows: PersonSheetRows): PersonDetailResponse {
  const { person } = rows;
  return {
    id: person.id,
    fullName: person.fullName,
    // O contrato exige CPF na pessoa principal; CPF nulo só existe nos resumos (pessoa importada).
    cpf: cpfSchema.parse(person.cpf),
    phone: person.phone,
    ...(person.email === null ? {} : { email: person.email }),
    ...(person.birthDate === null ? {} : { birthDate: person.birthDate }),
    ...(person.notes === null ? {} : { notes: person.notes }),
    active: person.active,
    version: person.version,
    referrer: rows.referrer,
    referrals: rows.referrals,
    addresses: rows.addresses.map(toAddress),
    pixKeys: rows.pixKeys.map(toPixKey),
  };
}

/** Ficha agregada da pessoa (RF-03/RF-04); `null` quando não existe. */
export async function getPersonSheet(db: Database, id: string): Promise<PersonDetailResponse | null> {
  const rows = await findPersonSheet(db, id);
  return rows === null ? null : toSheet(rows);
}
