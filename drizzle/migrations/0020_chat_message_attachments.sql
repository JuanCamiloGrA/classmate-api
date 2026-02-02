CREATE TABLE `message_attachments` (
  `id` text PRIMARY KEY NOT NULL,
  `message_id` text NOT NULL,
  `chat_id` text NOT NULL,
  `user_id` text NOT NULL,
  `r2_key` text NOT NULL,
  `thumbnail_r2_key` text,
  `original_filename` text NOT NULL,
  `mime_type` text NOT NULL,
  `size_bytes` integer NOT NULL,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE cascade,
  FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON DELETE cascade
);

CREATE INDEX `idx_message_attachments_message_id` ON `message_attachments` (`message_id`);
CREATE INDEX `idx_message_attachments_chat_id` ON `message_attachments` (`chat_id`);
CREATE UNIQUE INDEX `idx_message_attachments_message_r2_key` ON `message_attachments` (`message_id`, `r2_key`);
