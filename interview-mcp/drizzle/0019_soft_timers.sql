ALTER TABLE `sessions` ADD `pending_response_time_limit_sec` integer;
--> statement-breakpoint
ALTER TABLE `sessions` ADD `pending_response_started_at` text;
--> statement-breakpoint
ALTER TABLE `sessions` ADD `pending_answer_elapsed_sec` integer;
--> statement-breakpoint
ALTER TABLE `session_evaluations` ADD `answer_elapsed_sec` integer;
--> statement-breakpoint
ALTER TABLE `session_evaluations` ADD `response_time_limit_sec` integer;
