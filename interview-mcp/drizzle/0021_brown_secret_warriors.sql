CREATE TABLE `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `topic_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic_id` text NOT NULL,
	`order` integer NOT NULL,
	`text` text NOT NULL,
	`difficulty` text NOT NULL,
	`evaluation_criteria` text NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `topic_concepts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic_id` text NOT NULL,
	`cluster` text NOT NULL,
	`term` text NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `warmup_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic_id` text NOT NULL,
	`level` integer DEFAULT 0 NOT NULL,
	`stem` text NOT NULL,
	`choice_a` text NOT NULL,
	`choice_b` text NOT NULL,
	`choice_c` text NOT NULL,
	`choice_d` text NOT NULL,
	`correct_answer` text NOT NULL,
	`weight` integer DEFAULT 3 NOT NULL,
	`linked_question_order` integer,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `warmup_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`warmup_question_id` integer NOT NULL,
	`session_id` text NOT NULL,
	`correct` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`warmup_question_id`) REFERENCES `warmup_questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
