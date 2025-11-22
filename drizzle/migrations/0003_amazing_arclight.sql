ALTER TABLE `classes` ADD `meeting_link` text;--> statement-breakpoint
ALTER TABLE `classes` ADD `status` text DEFAULT 'completed';--> statement-breakpoint
ALTER TABLE `classes` ADD `ai_status` text DEFAULT 'none';--> statement-breakpoint
ALTER TABLE `classes` ADD `topics` text;--> statement-breakpoint
ALTER TABLE `classes` ADD `duration_seconds` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `subjects` ADD `professor` text;--> statement-breakpoint
ALTER TABLE `subjects` ADD `credits` integer DEFAULT 3;--> statement-breakpoint
ALTER TABLE `subjects` ADD `location` text;--> statement-breakpoint
ALTER TABLE `subjects` ADD `schedule_text` text;--> statement-breakpoint
ALTER TABLE `subjects` ADD `syllabus_url` text;--> statement-breakpoint
ALTER TABLE `subjects` ADD `color_theme` text DEFAULT 'indigo';