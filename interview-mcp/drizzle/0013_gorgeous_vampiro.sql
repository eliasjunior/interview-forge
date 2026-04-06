CREATE TABLE `flashcard_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`flashcard_id` text NOT NULL,
	`content` text NOT NULL,
	`state` text DEFAULT 'Pending' NOT NULL,
	`sm_rating` integer,
	`evaluated_at` text,
	`evaluation_result` text,
	`llm_verdict` text,
	`mistake_id` text,
	`new_flashcard_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`flashcard_id`) REFERENCES `flashcards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `flashcards` ADD `parent_flashcard_id` text;--> statement-breakpoint
ALTER TABLE `flashcards` ADD `replaced_by_flashcard_id` text;--> statement-breakpoint
ALTER TABLE `mistakes` ADD `source_answer_id` text;--> statement-breakpoint
ALTER TABLE `mistakes` ADD `source_flashcard_id` text;--> statement-breakpoint
ALTER TABLE `mistakes` ADD `replacement_flashcard_id` text;
