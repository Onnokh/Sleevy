CREATE TABLE "folders" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_items" ADD COLUMN "folder_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "folders_user_name_lower_unique" ON "folders" ("user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "saved_items_user_folder_id_idx" ON "saved_items" ("user_id","folder_id");--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_folder_id_folders_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL;