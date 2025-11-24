ALTER TABLE `scribe_documents` RENAME TO `scribe_projects`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_scribe_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`task_id` text,
	`subject_id` text,
	`title` text DEFAULT 'Untitled Draft' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`rubric_content` text,
	`form_questions` text,
	`user_answers` text,
	`content_markdown` text,
	`current_latex` text,
	`review_feedback` text,
	`workflow_id` text,
	`final_pdf_file_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`final_pdf_file_id`) REFERENCES `user_files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_scribe_projects`("id", "user_id", "task_id", "subject_id", "title", "status", "rubric_content", "form_questions", "user_answers", "content_markdown", "current_latex", "review_feedback", "workflow_id", "final_pdf_file_id", "created_at", "updated_at") SELECT "id", "user_id", "task_id", "subject_id", "title", "status", "rubric_content", "form_questions", "user_answers", "content_markdown", "current_latex", "review_feedback", "workflow_id", "final_pdf_file_id", "created_at", "updated_at" FROM `scribe_projects`;--> statement-breakpoint
DROP TABLE `scribe_projects`;--> statement-breakpoint
ALTER TABLE `__new_scribe_projects` RENAME TO `scribe_projects`;--> statement-breakpoint
PRAGMA foreign_keys=ON;