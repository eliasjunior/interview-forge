PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_flashcards` (
	`id` text PRIMARY KEY NOT NULL,
	`front` text NOT NULL,
	`back` text NOT NULL,
	`topic` text NOT NULL,
	`difficulty` text NOT NULL,
	`created_at` text NOT NULL,
	`due_date` text NOT NULL,
	`interval` integer NOT NULL,
	`ease_factor` real NOT NULL,
	`repetitions` integer NOT NULL,
	`last_reviewed_at` text,
	`source_session_id` text,
	`source_question_index` integer,
	`source_original_score` integer,
	`title` text,
	`focus_item` text,
	`study_notes` text
);
--> statement-breakpoint
INSERT INTO `__new_flashcards`("id", "front", "back", "topic", "difficulty", "created_at", "due_date", "interval", "ease_factor", "repetitions", "last_reviewed_at", "source_session_id", "source_question_index", "source_original_score", "title", "focus_item", "study_notes") SELECT "id", "front", "back", "topic", "difficulty", "created_at", "due_date", "interval", "ease_factor", "repetitions", "last_reviewed_at", "source_session_id", "source_question_index", "source_original_score", "title", "focus_item", "study_notes" FROM `flashcards`;--> statement-breakpoint
DROP TABLE `flashcards`;--> statement-breakpoint
ALTER TABLE `__new_flashcards` RENAME TO `flashcards`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
