ALTER TABLE `sessions` ADD `pending_answer_mode` text;
--> statement-breakpoint
ALTER TABLE `session_evaluations` ADD `answer_mode` text;
