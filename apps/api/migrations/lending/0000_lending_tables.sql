CREATE SCHEMA "lending";
--> statement-breakpoint
CREATE TABLE "lending"."default_terms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"late_fee_bps" integer NOT NULL,
	"late_interest_monthly_bps" integer NOT NULL,
	"grace_period_days" integer NOT NULL,
	"suggested_monthly_rate_bps" integer NOT NULL,
	"rounding_step_cents" bigint DEFAULT 500 NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "default_terms_late_fee_bps_check" CHECK ("lending"."default_terms"."late_fee_bps" >= 0),
	CONSTRAINT "default_terms_late_interest_monthly_bps_check" CHECK ("lending"."default_terms"."late_interest_monthly_bps" >= 0),
	CONSTRAINT "default_terms_grace_period_days_check" CHECK ("lending"."default_terms"."grace_period_days" >= 0),
	CONSTRAINT "default_terms_suggested_monthly_rate_bps_check" CHECK ("lending"."default_terms"."suggested_monthly_rate_bps" >= 0),
	CONSTRAINT "default_terms_rounding_step_cents_check" CHECK ("lending"."default_terms"."rounding_step_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "lending"."installments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"loan_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"due_date" date NOT NULL,
	"principal_cents" bigint NOT NULL,
	"interest_cents" bigint NOT NULL,
	"total_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "installments_loan_id_number_key" UNIQUE("loan_id","number"),
	CONSTRAINT "installments_number_check" CHECK ("lending"."installments"."number" >= 1),
	CONSTRAINT "installments_principal_cents_check" CHECK ("lending"."installments"."principal_cents" >= 0),
	CONSTRAINT "installments_interest_cents_check" CHECK ("lending"."installments"."interest_cents" >= 0),
	CONSTRAINT "installments_total_cents_check" CHECK ("lending"."installments"."total_cents" = "lending"."installments"."principal_cents" + "lending"."installments"."interest_cents")
);
--> statement-breakpoint
CREATE TABLE "lending"."loan_number_sequences" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "loan_number_sequences_last_value_check" CHECK ("lending"."loan_number_sequences"."last_value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lending"."loans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"loan_number" text NOT NULL,
	"person_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"principal_cents" bigint NOT NULL,
	"monthly_interest_rate_bps" integer NOT NULL,
	"installment_count" integer,
	"frequency_unit" text NOT NULL,
	"frequency_interval" integer NOT NULL,
	"first_due_date" date NOT NULL,
	"contracted_at" date NOT NULL,
	"disbursed_at" date,
	"account_id" uuid NOT NULL,
	"origin_loan_id" uuid,
	"origin_type" text,
	"capitalized_amount_cents" bigint DEFAULT 0 NOT NULL,
	"late_fee_bps" integer NOT NULL,
	"late_interest_monthly_bps" integer NOT NULL,
	"grace_period_days" integer NOT NULL,
	"rounding_step_cents" bigint NOT NULL,
	"write_off_reason" text,
	"internal_notes" text,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "loans_loan_number_key" UNIQUE("loan_number"),
	CONSTRAINT "loans_loan_number_check" CHECK ("lending"."loans"."loan_number" ~ '^[0-9]{4}-[0-9]{4,}$'),
	CONSTRAINT "loans_type_check" CHECK ("lending"."loans"."type" IN ('INSTALLMENT', 'SINGLE_PAYMENT', 'INTEREST_ONLY', 'CUSTOM')),
	CONSTRAINT "loans_status_check" CHECK ("lending"."loans"."status" IN ('DRAFT', 'ACTIVE', 'PAID_OFF', 'RENEWED', 'RENEGOTIATED', 'WRITTEN_OFF', 'CANCELLED')),
	CONSTRAINT "loans_principal_cents_check" CHECK ("lending"."loans"."principal_cents" > 0),
	CONSTRAINT "loans_monthly_interest_rate_bps_check" CHECK ("lending"."loans"."monthly_interest_rate_bps" >= 0),
	CONSTRAINT "loans_installment_count_check" CHECK (("lending"."loans"."installment_count" IS NOT NULL AND "lending"."loans"."installment_count" >= 1) OR ("lending"."loans"."installment_count" IS NULL AND "lending"."loans"."type" = 'INTEREST_ONLY')),
	CONSTRAINT "loans_frequency_unit_check" CHECK ("lending"."loans"."frequency_unit" IN ('DAY', 'MONTH')),
	CONSTRAINT "loans_frequency_interval_check" CHECK ("lending"."loans"."frequency_interval" >= 1),
	CONSTRAINT "loans_disbursed_at_check" CHECK ("lending"."loans"."status" IN ('DRAFT', 'CANCELLED') OR "lending"."loans"."disbursed_at" IS NOT NULL),
	CONSTRAINT "loans_origin_type_check" CHECK ("lending"."loans"."origin_type" IN ('RENEWAL', 'RENEGOTIATION', 'IMPORT')),
	CONSTRAINT "loans_capitalized_amount_cents_check" CHECK ("lending"."loans"."capitalized_amount_cents" >= 0),
	CONSTRAINT "loans_late_fee_bps_check" CHECK ("lending"."loans"."late_fee_bps" >= 0),
	CONSTRAINT "loans_late_interest_monthly_bps_check" CHECK ("lending"."loans"."late_interest_monthly_bps" >= 0),
	CONSTRAINT "loans_grace_period_days_check" CHECK ("lending"."loans"."grace_period_days" >= 0),
	CONSTRAINT "loans_rounding_step_cents_check" CHECK ("lending"."loans"."rounding_step_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "lending"."installments" ADD CONSTRAINT "installments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "lending"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lending"."loans" ADD CONSTRAINT "loans_origin_loan_id_fkey" FOREIGN KEY ("origin_loan_id") REFERENCES "lending"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "default_terms_effective_from_idx" ON "lending"."default_terms" USING btree ("effective_from");--> statement-breakpoint
CREATE INDEX "installments_due_date_idx" ON "lending"."installments" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "loans_person_id_status_idx" ON "lending"."loans" USING btree ("person_id","status");--> statement-breakpoint
CREATE INDEX "loans_status_idx" ON "lending"."loans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "loans_origin_loan_id_idx" ON "lending"."loans" USING btree ("origin_loan_id");--> statement-breakpoint
CREATE INDEX "loans_account_id_idx" ON "lending"."loans" USING btree ("account_id");