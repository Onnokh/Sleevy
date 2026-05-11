ALTER TABLE "link_enrichment" RENAME COLUMN "topic" TO "tags";--> statement-breakpoint
DROP INDEX "link_enrichment_topic_idx";--> statement-breakpoint
ALTER TABLE "saved_items" DROP COLUMN "topic_override";--> statement-breakpoint
ALTER TABLE "link_enrichment" ALTER COLUMN "tags" SET DATA TYPE text[] USING COALESCE(ARRAY["tags"::text], '{}'::text[]);--> statement-breakpoint
ALTER TABLE "link_enrichment" ALTER COLUMN "tags" SET DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "link_enrichment" ALTER COLUMN "tags" SET NOT NULL;--> statement-breakpoint
DROP TYPE "topic";