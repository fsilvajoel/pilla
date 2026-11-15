CREATE SCHEMA "core";
--> statement-breakpoint
CREATE TABLE "core"."outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"event_version" integer NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "core"."processed_events" (
	"consumer" text NOT NULL,
	"event_id" uuid NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processed_events_consumer_event_id_pk" PRIMARY KEY("consumer","event_id")
);
--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "core"."outbox" USING btree ("occurred_at") WHERE "core"."outbox"."published_at" IS NULL;