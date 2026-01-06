ALTER TABLE `scribe_projects` RENAME COLUMN "final_pdf_file_id" TO "final_pdf_r2_key";--> statement-breakpoint
ALTER TABLE `scribe_projects` DROP COLUMN `final_pdf_url`;