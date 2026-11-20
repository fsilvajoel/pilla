import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgSchema,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { instant } from "../../db/columns";

// Schema `people` (RFC-005 §3): pessoas, endereços e chaves Pix.
export const people = pgSchema("people");

// Pessoa (RFC-005 §3): cliente, indicador e usuário apontam para a mesma pessoa (RN-P03).
export const persons = people.table(
  "persons",
  {
    id: uuid("id").primaryKey(),
    fullName: text("full_name").notNull(),
    cpf: char("cpf", { length: 11 }),
    phone: text("phone").notNull(),
    email: text("email"),
    birthDate: date("birth_date"),
    referredById: uuid("referred_by_id"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    anonymizedAt: instant("anonymized_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    index("persons_full_name_idx").on(sql`lower(${t.fullName})`),
    index("persons_phone_idx").on(t.phone),
    index("persons_referred_by_id_idx").on(t.referredById),
    uniqueIndex("persons_cpf_key")
      .on(t.cpf)
      .where(sql`${t.cpf} IS NOT NULL`),
    foreignKey({
      name: "persons_referred_by_id_fkey",
      columns: [t.referredById],
      foreignColumns: [t.id],
    }),
    check("persons_cpf_check", sql`${t.cpf} ~ '^[0-9]{11}$'`),
    check("persons_phone_check", sql`${t.phone} ~ '^[+][1-9][0-9]{7,14}$'`),
    check("persons_referred_by_id_check", sql`${t.referredById} <> ${t.id}`),
  ],
);

export type PersonRow = typeof persons.$inferSelect;

// Endereço da pessoa (RFC-005 §3): no máximo um principal por pessoa.
export const addresses = people.table(
  "addresses",
  {
    id: uuid("id").primaryKey(),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id),
    street: text("street").notNull(),
    number: text("number").notNull(),
    complement: text("complement"),
    district: text("district").notNull(),
    city: text("city").notNull(),
    state: char("state", { length: 2 }).notNull(),
    postalCode: char("postal_code", { length: 8 }).notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    uniqueIndex("addresses_one_primary_idx")
      .on(t.personId)
      .where(sql`${t.isPrimary}`),
    check("addresses_state_check", sql`${t.state} ~ '^[A-Z]{2}$'`),
    check("addresses_postal_code_check", sql`${t.postalCode} ~ '^[0-9]{8}$'`),
  ],
);

export type AddressRow = typeof addresses.$inferSelect;

// Chave Pix da pessoa (RFC-005 §3): a mesma chave pode se repetir (MVP); no máximo uma principal por pessoa.
export const pixKeys = people.table(
  "pix_keys",
  {
    id: uuid("id").primaryKey(),
    ownerPersonId: uuid("owner_person_id")
      .notNull()
      .references(() => persons.id),
    type: text("type").notNull(),
    value: text("value").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    check("pix_keys_type_check", sql`${t.type} IN ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM')`),
    uniqueIndex("pix_keys_one_primary_idx")
      .on(t.ownerPersonId)
      .where(sql`${t.isPrimary}`),
  ],
);

export type PixKeyRow = typeof pixKeys.$inferSelect;
