CREATE TABLE "connect_codes" (
	"code" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"client" text NOT NULL,
	"scopes" text[] NOT NULL,
	"label" text NOT NULL,
	"device_hint" text,
	"code_challenge" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "connect_codes_expires_at_idx" ON "connect_codes" ("expires_at");--> statement-breakpoint
ALTER TABLE "connect_codes" ADD CONSTRAINT "connect_codes_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;