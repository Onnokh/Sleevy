CREATE TYPE "capture_channel" AS ENUM('chrome-extension', 'ios-app', 'ios-share-extension', 'raycast', 'web-companion', 'api');--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_items" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "saved_items" ADD COLUMN "capture_channel" "capture_channel";--> statement-breakpoint
CREATE UNIQUE INDEX "sources_user_name_unique" ON "sources" ("user_id","name");--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_source_id_sources_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;