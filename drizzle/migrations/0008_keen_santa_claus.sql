ALTER TABLE `scribe_projects` ADD `is_deleted` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `scribe_projects` ADD `deleted_at` text;