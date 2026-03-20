CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL UNIQUE,
	`confidence` integer NOT NULL DEFAULT 1,
	`sub_skills` text NOT NULL DEFAULT '[]',
	`related_problems` text NOT NULL DEFAULT '[]',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
