CREATE TABLE "core"."audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone NOT NULL,
	"ip" "inet",
	CONSTRAINT "audit_log_actor_type_check" CHECK ("core"."audit_log"."actor_type" IN ('ADMIN', 'CLIENT', 'SYSTEM'))
);
--> statement-breakpoint
CREATE INDEX "audit_log_history_idx" ON "core"."audit_log" USING btree ("entity_type","entity_id","at");