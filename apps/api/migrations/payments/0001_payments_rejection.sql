ALTER TABLE "payments"."payments" DROP CONSTRAINT "payments_status_check";--> statement-breakpoint
ALTER TABLE "payments"."payments" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments"."payments" ADD COLUMN "rejected_by" uuid;--> statement-breakpoint
ALTER TABLE "payments"."payments" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "payments"."payments" ADD CONSTRAINT "payments_status_check" CHECK ("payments"."payments"."status" IN ('PENDING_REVIEW', 'CONFIRMED', 'REVERSED', 'REJECTED'));