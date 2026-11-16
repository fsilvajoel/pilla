CREATE SCHEMA "access";
--> statement-breakpoint
CREATE TABLE "access"."access_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" "inet" NOT NULL,
	"cpf_hash" char(64) NOT NULL,
	"result" text NOT NULL,
	CONSTRAINT "access_logs_result_check" CHECK ("access"."access_logs"."result" IN ('OK', 'NOT_FOUND', 'DISABLED', 'RATE_LIMITED'))
);
--> statement-breakpoint
CREATE TABLE "access"."admin_users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "admin_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "access"."portal_access" (
	"person_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"enabled_at" timestamp with time zone,
	"enabled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "portal_access_enabled_check" CHECK (NOT "access"."portal_access"."enabled" OR ("access"."portal_access"."enabled_at" IS NOT NULL AND "access"."portal_access"."enabled_by" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "access"."sessions" (
	"id" char(64) PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"admin_user_id" uuid,
	"person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" "inet" NOT NULL,
	CONSTRAINT "sessions_role_check" CHECK ("access"."sessions"."role" IN ('ADMIN', 'CLIENT')),
	CONSTRAINT "sessions_role_owner_check" CHECK (("access"."sessions"."role" = 'ADMIN' AND "access"."sessions"."admin_user_id" IS NOT NULL AND "access"."sessions"."person_id" IS NULL)
        OR ("access"."sessions"."role" = 'CLIENT' AND "access"."sessions"."person_id" IS NOT NULL AND "access"."sessions"."admin_user_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "access"."portal_access" ADD CONSTRAINT "portal_access_enabled_by_admin_users_id_fk" FOREIGN KEY ("enabled_by") REFERENCES "access"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access"."sessions" ADD CONSTRAINT "sessions_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "access"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_logs_ip_at_idx" ON "access"."access_logs" USING btree ("ip","at");--> statement-breakpoint
CREATE INDEX "portal_access_enabled_by_idx" ON "access"."portal_access" USING btree ("enabled_by");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "access"."sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_admin_user_id_idx" ON "access"."sessions" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "sessions_person_id_idx" ON "access"."sessions" USING btree ("person_id");