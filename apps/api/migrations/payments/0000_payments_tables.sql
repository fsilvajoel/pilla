CREATE SCHEMA "payments";
--> statement-breakpoint
CREATE TABLE "payments"."payment_allocations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_id" uuid NOT NULL,
	"loan_id" uuid NOT NULL,
	"installment_id" uuid NOT NULL,
	"late_charges_cents" bigint NOT NULL,
	"interest_cents" bigint NOT NULL,
	"principal_cents" bigint NOT NULL,
	"reversed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_allocations_late_charges_cents_check" CHECK ("payments"."payment_allocations"."late_charges_cents" >= 0),
	CONSTRAINT "payment_allocations_interest_cents_check" CHECK ("payments"."payment_allocations"."interest_cents" >= 0),
	CONSTRAINT "payment_allocations_principal_cents_check" CHECK ("payments"."payment_allocations"."principal_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payments"."payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"loan_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"paid_at" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	"method" text NOT NULL,
	"receipt_attachment_id" uuid,
	"pix_end_to_end_id" text,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"is_recovery" boolean DEFAULT false NOT NULL,
	"idempotency_key" text,
	"confirmed_at" timestamp with time zone,
	"confirmed_by" uuid,
	"reversed_at" timestamp with time zone,
	"reversed_by" uuid,
	"reversal_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "payments_idempotency_key_key" UNIQUE("idempotency_key"),
	CONSTRAINT "payments_amount_cents_check" CHECK ("payments"."payments"."amount_cents" > 0),
	CONSTRAINT "payments_method_check" CHECK ("payments"."payments"."method" IN ('PIX', 'BOLETO', 'CASH', 'BANK_TRANSFER')),
	CONSTRAINT "payments_channel_check" CHECK ("payments"."payments"."channel" IN ('ADMIN')),
	CONSTRAINT "payments_status_check" CHECK ("payments"."payments"."status" IN ('PENDING_REVIEW', 'CONFIRMED', 'REVERSED'))
);
--> statement-breakpoint
ALTER TABLE "payments"."payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payments"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_allocations_open_installment_id_idx" ON "payments"."payment_allocations" USING btree ("installment_id") WHERE "payments"."payment_allocations"."reversed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "payment_allocations_loan_id_idx" ON "payments"."payment_allocations" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_id_idx" ON "payments"."payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payments_loan_id_status_idx" ON "payments"."payments" USING btree ("loan_id","status");--> statement-breakpoint
CREATE INDEX "payments_pending_review_idx" ON "payments"."payments" USING btree ("status") WHERE "payments"."payments"."status" = 'PENDING_REVIEW';--> statement-breakpoint
CREATE INDEX "payments_person_id_idx" ON "payments"."payments" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "payments_account_id_idx" ON "payments"."payments" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "payments_receipt_attachment_id_idx" ON "payments"."payments" USING btree ("receipt_attachment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_pix_end_to_end_id_key" ON "payments"."payments" USING btree ("pix_end_to_end_id") WHERE "payments"."payments"."pix_end_to_end_id" IS NOT NULL;