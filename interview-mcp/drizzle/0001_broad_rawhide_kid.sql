DROP INDEX `session_evaluations_session_question_idx`;--> statement-breakpoint
ALTER TABLE `session_evaluations` ADD `position` integer NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `session_evaluations_session_position_idx` ON `session_evaluations` (`session_id`,`position`);