CREATE TABLE `scribe_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`task_id` text,
	`subject_id` text,
	`title` text DEFAULT 'Untitled Draft' NOT NULL,
	`status` text DEFAULT 'draft',
	`wizard_data` text,
	`content_markdown` text,
	`final_pdf_file_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`final_pdf_file_id`) REFERENCES `user_files`(`id`) ON UPDATE no action ON DELETE no action
);
