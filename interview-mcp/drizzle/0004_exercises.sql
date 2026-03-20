CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL UNIQUE,
	`slug` text NOT NULL UNIQUE,
	`topic` text NOT NULL,
	`language` text NOT NULL DEFAULT 'any',
	`difficulty` integer NOT NULL DEFAULT 3,
	`description` text NOT NULL,
	`prerequisites` text NOT NULL DEFAULT '[]',
	`file_path` text NOT NULL,
	`created_at` text NOT NULL
);
