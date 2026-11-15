CREATE TABLE "core"."attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" char(64) NOT NULL,
	"storage_key" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"uploaded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "attachments_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "attachments_kind_check" CHECK ("core"."attachments"."kind" IN ('RECEIPT', 'SIGNED_CONTRACT', 'IMPORT_FILE', 'OTHER')),
	CONSTRAINT "attachments_size_bytes_check" CHECK ("core"."attachments"."size_bytes" >= 0),
	CONSTRAINT "attachments_sha256_check" CHECK ("core"."attachments"."sha256" ~ '^[0-9a-f]{64}$')
);
