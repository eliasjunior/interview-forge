ALTER TABLE `graph_edges` ADD `kind` text NOT NULL DEFAULT 'cooccurrence';--> statement-breakpoint
ALTER TABLE `graph_edges` ADD `relation` text NOT NULL DEFAULT 'co-occurs-with';--> statement-breakpoint
DROP INDEX `graph_edges_source_target_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `graph_edges_source_target_kind_relation_idx` ON `graph_edges` (`source`,`target`,`kind`,`relation`);
