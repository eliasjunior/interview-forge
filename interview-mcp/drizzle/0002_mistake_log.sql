CREATE TABLE `mistakes` (
	`id` text PRIMARY KEY NOT NULL,
	`mistake` text NOT NULL,
	`pattern` text NOT NULL,
	`fix` text NOT NULL,
	`topic` text,
	`created_at` text NOT NULL
);
