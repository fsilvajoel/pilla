import { sql } from "drizzle-orm";
import { boolean, char, check, index, inet, integer, pgSchema, text, uuid } from "drizzle-orm/pg-core";
import { instant } from "../../db/columns";

// Schema `access` (RFC-005 §7): administradores, sessões, acesso ao portal e o registro de tentativas.
export const accessSchema = pgSchema("access");

// Administrador (RFC-005 §7, ADR-0011): entra com usuário e senha; a senha só existe como hash argon2id.
export const adminUsers = accessSchema.table("admin_users", {
  id: uuid("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  lastLoginAt: instant("last_login_at"),
  createdAt: instant("created_at").notNull().defaultNow(),
  updatedAt: instant("updated_at").notNull().defaultNow(),
  version: integer("version").notNull().default(1),
});

export type AdminUserRow = typeof adminUsers.$inferSelect;

// Sessão (RFC-005 §7, ADR-0011). O id é o hash SHA-256 (hex) do token: o token em si nunca é gravado.
// ADMIN aponta para admin_users; CLIENT aponta para a pessoa, que é de `people` (só uuid e índice, ADR-0002).
export const sessions = accessSchema.table(
  "sessions",
  {
    id: char("id", { length: 64 }).primaryKey(),
    role: text("role").notNull(),
    adminUserId: uuid("admin_user_id").references(() => adminUsers.id),
    personId: uuid("person_id"),
    createdAt: instant("created_at").notNull().defaultNow(),
    expiresAt: instant("expires_at").notNull(),
    lastSeenAt: instant("last_seen_at").notNull().defaultNow(),
    ip: inet("ip").notNull(),
  },
  (t) => [
    index("sessions_expires_at_idx").on(t.expiresAt),
    index("sessions_admin_user_id_idx").on(t.adminUserId),
    index("sessions_person_id_idx").on(t.personId),
    check("sessions_role_check", sql`${t.role} IN ('ADMIN', 'CLIENT')`),
    check(
      "sessions_role_owner_check",
      sql`(${t.role} = 'ADMIN' AND ${t.adminUserId} IS NOT NULL AND ${t.personId} IS NULL)
        OR (${t.role} = 'CLIENT' AND ${t.personId} IS NOT NULL AND ${t.adminUserId} IS NULL)`,
    ),
  ],
);

export type SessionRow = typeof sessions.$inferSelect;

// Acesso da pessoa ao portal (RFC-005 §7): uma linha por pessoa; habilitado sempre diz quando e por quem.
export const portalAccess = accessSchema.table(
  "portal_access",
  {
    personId: uuid("person_id").primaryKey(),
    enabled: boolean("enabled").notNull(),
    enabledAt: instant("enabled_at"),
    enabledBy: uuid("enabled_by").references(() => adminUsers.id),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    index("portal_access_enabled_by_idx").on(t.enabledBy),
    check(
      "portal_access_enabled_check",
      sql`NOT ${t.enabled} OR (${t.enabledAt} IS NOT NULL AND ${t.enabledBy} IS NOT NULL)`,
    ),
  ],
);

export type PortalAccessRow = typeof portalAccess.$inferSelect;

// Tentativa de entrada no portal (RFC-005 §7): só acrescenta; o índice (ip, at) sustenta o limite por IP.
// Guarda o hash do CPF digitado (RFC-005 §7), não o CPF.
export const accessLogs = accessSchema.table(
  "access_logs",
  {
    id: uuid("id").primaryKey(),
    at: instant("at").notNull().defaultNow(),
    ip: inet("ip").notNull(),
    cpfHash: char("cpf_hash", { length: 64 }).notNull(),
    result: text("result").notNull(),
  },
  (t) => [
    index("access_logs_ip_at_idx").on(t.ip, t.at),
    check("access_logs_result_check", sql`${t.result} IN ('OK', 'NOT_FOUND', 'DISABLED', 'RATE_LIMITED')`),
  ],
);

export type AccessLogRow = typeof accessLogs.$inferSelect;
