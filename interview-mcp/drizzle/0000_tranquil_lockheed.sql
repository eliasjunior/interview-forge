CREATE TABLE `flashcard_concepts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`flashcard_id` text NOT NULL,
	`concept` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`flashcard_id`) REFERENCES `flashcards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `flashcard_concepts_flashcard_position_idx` ON `flashcard_concepts` (`flashcard_id`,`position`);--> statement-breakpoint
CREATE TABLE `flashcard_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`flashcard_id` text NOT NULL,
	`tag` text NOT NULL,
	FOREIGN KEY (`flashcard_id`) REFERENCES `flashcards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `flashcard_tags_flashcard_tag_idx` ON `flashcard_tags` (`flashcard_id`,`tag`);--> statement-breakpoint
CREATE TABLE `flashcards` (
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
	`source_session_id` text NOT NULL,
	`source_question_index` integer NOT NULL,
	`source_original_score` integer NOT NULL,
	`title` text,
	`focus_item` text,
	`study_notes` text,
	FOREIGN KEY (`source_session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `graph_edges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`target` text NOT NULL,
	`weight` integer NOT NULL,
	FOREIGN KEY (`source`) REFERENCES `graph_nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target`) REFERENCES `graph_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `graph_edges_source_target_idx` ON `graph_edges` (`source`,`target`);--> statement-breakpoint
CREATE TABLE `graph_node_clusters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`node_id` text NOT NULL,
	`cluster` text NOT NULL,
	FOREIGN KEY (`node_id`) REFERENCES `graph_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `graph_node_clusters_node_cluster_idx` ON `graph_node_clusters` (`node_id`,`cluster`);--> statement-breakpoint
CREATE TABLE `graph_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `graph_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `graph_sessions_session_id_unique` ON `graph_sessions` (`session_id`);--> statement-breakpoint
CREATE TABLE `session_concepts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`word` text NOT NULL,
	`cluster` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session_evaluations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`question_index` integer NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`strong_answer` text,
	`score` integer NOT NULL,
	`feedback` text NOT NULL,
	`needs_follow_up` integer NOT NULL,
	`follow_up_question` text,
	`deeper_dive` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_evaluations_session_question_idx` ON `session_evaluations` (`session_id`,`question_index`);--> statement-breakpoint
CREATE TABLE `session_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`position` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`timestamp` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_messages_session_position_idx` ON `session_messages` (`session_id`,`position`);--> statement-breakpoint
CREATE TABLE `session_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`position` integer NOT NULL,
	`question` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_questions_session_position_idx` ON `session_questions` (`session_id`,`position`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`topic` text NOT NULL,
	`interview_type` text,
	`session_kind` text,
	`study_category` text,
	`source_path` text,
	`source_type` text,
	`seeded` integer DEFAULT false NOT NULL,
	`custom_content` text,
	`focus_area` text,
	`state` text NOT NULL,
	`current_question_index` integer NOT NULL,
	`summary` text,
	`knowledge_source` text NOT NULL,
	`created_at` text NOT NULL,
	`ended_at` text
);
