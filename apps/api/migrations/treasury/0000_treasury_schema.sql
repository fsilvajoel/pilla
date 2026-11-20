CREATE SCHEMA "treasury";
--> statement-breakpoint
CREATE TABLE "treasury"."accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"pix_key_id" uuid,
	"description" text,
	"max_committed_bps" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "accounts_max_committed_bps_check" CHECK ("treasury"."accounts"."max_committed_bps" BETWEEN 0 AND 10000)
);
--> statement-breakpoint
CREATE TABLE "treasury"."ledger_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"component" text,
	"source_type" text,
	"source_id" uuid,
	"source_event_id" uuid,
	"entry_date" date NOT NULL,
	"justification" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_source_event_id_component_key" UNIQUE("source_event_id","component"),
	CONSTRAINT "ledger_entries_type_check" CHECK ("treasury"."ledger_entries"."type" IN ('CAPITAL_IN', 'CAPITAL_OUT', 'DISBURSEMENT', 'REPAYMENT', 'REVERSAL', 'ADJUSTMENT')),
	CONSTRAINT "ledger_entries_amount_cents_check" CHECK ("treasury"."ledger_entries"."amount_cents" <> 0),
	CONSTRAINT "ledger_entries_component_check" CHECK ("treasury"."ledger_entries"."component" IN ('PRINCIPAL', 'INTEREST', 'LATE_CHARGES', 'RECOVERY')),
	CONSTRAINT "ledger_entries_source_type_check" CHECK ("treasury"."ledger_entries"."source_type" IN ('LOAN', 'PAYMENT')),
	CONSTRAINT "ledger_entries_justification_check" CHECK ("treasury"."ledger_entries"."type" <> 'ADJUSTMENT' OR ("treasury"."ledger_entries"."justification" IS NOT NULL AND length(trim("treasury"."ledger_entries"."justification")) > 0))
);
--> statement-breakpoint
ALTER TABLE "treasury"."ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "treasury"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_pix_key_id_idx" ON "treasury"."accounts" USING btree ("pix_key_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_account_id_entry_date_idx" ON "treasury"."ledger_entries" USING btree ("account_id","entry_date");--> statement-breakpoint
CREATE INDEX "ledger_entries_source_type_source_id_idx" ON "treasury"."ledger_entries" USING btree ("source_type","source_id");