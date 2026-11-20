CREATE TABLE "people"."addresses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"street" text NOT NULL,
	"number" text NOT NULL,
	"complement" text,
	"district" text NOT NULL,
	"city" text NOT NULL,
	"state" char(2) NOT NULL,
	"postal_code" char(8) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "addresses_state_check" CHECK ("people"."addresses"."state" ~ '^[A-Z]{2}$'),
	CONSTRAINT "addresses_postal_code_check" CHECK ("people"."addresses"."postal_code" ~ '^[0-9]{8}$')
);
--> statement-breakpoint
CREATE TABLE "people"."persons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"cpf" char(11),
	"phone" text NOT NULL,
	"email" text,
	"birth_date" date,
	"referred_by_id" uuid,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"anonymized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "persons_cpf_check" CHECK ("people"."persons"."cpf" ~ '^[0-9]{11}$'),
	CONSTRAINT "persons_phone_check" CHECK ("people"."persons"."phone" ~ '^[+][1-9][0-9]{7,14}$'),
	CONSTRAINT "persons_referred_by_id_check" CHECK ("people"."persons"."referred_by_id" <> "people"."persons"."id")
);
--> statement-breakpoint
CREATE TABLE "people"."pix_keys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_person_id" uuid NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "pix_keys_type_value_key" UNIQUE("type","value"),
	CONSTRAINT "pix_keys_type_check" CHECK ("people"."pix_keys"."type" IN ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM'))
);
--> statement-breakpoint
ALTER TABLE "people"."addresses" ADD CONSTRAINT "addresses_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "people"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people"."persons" ADD CONSTRAINT "persons_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "people"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people"."pix_keys" ADD CONSTRAINT "pix_keys_owner_person_id_persons_id_fk" FOREIGN KEY ("owner_person_id") REFERENCES "people"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "addresses_one_primary_idx" ON "people"."addresses" USING btree ("person_id") WHERE "people"."addresses"."is_primary";--> statement-breakpoint
CREATE INDEX "persons_full_name_idx" ON "people"."persons" USING btree (lower("full_name"));--> statement-breakpoint
CREATE INDEX "persons_phone_idx" ON "people"."persons" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "persons_referred_by_id_idx" ON "people"."persons" USING btree ("referred_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "persons_cpf_key" ON "people"."persons" USING btree ("cpf") WHERE "people"."persons"."cpf" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "pix_keys_one_primary_idx" ON "people"."pix_keys" USING btree ("owner_person_id") WHERE "people"."pix_keys"."is_primary";