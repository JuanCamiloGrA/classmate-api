CREATE TABLE `user_storage_objects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`bucket_type` text DEFAULT 'persistent' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`confirmed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_user_storage_objects_user_id` ON `user_storage_objects` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_storage_objects_r2_key` ON `user_storage_objects` (`r2_key`);