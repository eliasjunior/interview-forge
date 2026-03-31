CREATE TABLE `topic_plans` (
	`topic` text PRIMARY KEY NOT NULL,
	`focused` integer DEFAULT false NOT NULL,
	`priority` text DEFAULT 'secondary' NOT NULL,
	`updated_at` text NOT NULL
);
