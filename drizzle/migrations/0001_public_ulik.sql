CREATE TABLE `flashcards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`front` text NOT NULL,
	`back` text NOT NULL,
	`difficulty_rating` integer DEFAULT 0 NOT NULL,
	`created_from_class_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_from_class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_flashcards_user_id_subject_id` ON `flashcards` (`user_id`,`subject_id`);--> statement-breakpoint
CREATE INDEX `idx_flashcards_created_from_class_id` ON `flashcards` (`created_from_class_id`);--> statement-breakpoint
ALTER TABLE `chats` ADD `context_type` text;--> statement-breakpoint
ALTER TABLE `chats` ADD `context_id` text;--> statement-breakpoint
ALTER TABLE `classes` ADD `transcription_text` text;--> statement-breakpoint
ALTER TABLE `classes` ADD `room_location` text;--> statement-breakpoint
ALTER TABLE `classes` ADD `is_processed` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `priority` text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `task_type` text DEFAULT 'assignment' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `draft_content` text;