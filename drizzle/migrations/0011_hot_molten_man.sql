ALTER TABLE `scribe_projects` RENAME COLUMN "current_latex" TO "current_typst_json";--> statement-breakpoint
ALTER TABLE `scribe_projects` ADD `template_id` text DEFAULT 'apa' NOT NULL;