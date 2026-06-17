CREATE TABLE `algorithm_problems` (
  `id` text PRIMARY KEY NOT NULL,
  `problem` text NOT NULL,
  `pattern` text DEFAULT '' NOT NULL,
  `difficulty` text DEFAULT 'Medium' NOT NULL,
  `tricky_part` text DEFAULT '' NOT NULL,
  `mental_model` text DEFAULT '' NOT NULL,
  `common_mistake` text DEFAULT '' NOT NULL,
  `complexity` text DEFAULT '' NOT NULL,
  `re_solved_without_help` integer DEFAULT false NOT NULL,
  `date_last_reviewed` text,
  `next_review_days` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
