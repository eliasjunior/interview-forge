CREATE TABLE `code_challenges` (
	`session_id` text PRIMARY KEY NOT NULL,
	`language` text NOT NULL,
	`function_signature` text NOT NULL,
	`starter_code` text NOT NULL,
	`sample_tests` text DEFAULT '[]' NOT NULL,
	`hints` text DEFAULT '[]' NOT NULL,
	`hidden_test_count` integer DEFAULT 0 NOT NULL,
	`test_harness` text NOT NULL,
	`reference_solution` text NOT NULL,
	`teacher_notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
