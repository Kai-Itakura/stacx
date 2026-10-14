CREATE TABLE `star_tags` (
	`star_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`star_id`, `tag_id`),
	FOREIGN KEY (`star_id`) REFERENCES `stars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `stars` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`situation` text,
	`task` text,
	`action` text,
	`result` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- ここから手書き。Memo を STAR へ写す（ADR 0009 の Expand）。古いテーブルは Contract まで残す。
-- STAR 化済みの Memo は S/T/A/R を star_logs から取り、本文を作業ログ（notes）へ入れる。
-- 未 STAR 化の Memo は本文を result へ入れる。situation に入れると全件が「未解決の問題」になるため。
-- star_logs があっても 4 項目とも空なら未 STAR 化と同じに扱い、STAR の不変条件（少なくとも 1 項目）を守る。
INSERT INTO `stars` (`id`, `user_id`, `project_id`, `situation`, `task`, `action`, `result`, `notes`, `created_at`, `updated_at`)
SELECT
	`id`,
	`user_id`,
	`project_id`,
	CASE WHEN `starred` THEN `s` END,
	CASE WHEN `starred` THEN `t` END,
	CASE WHEN `starred` THEN `a` END,
	CASE WHEN `starred` THEN `r` ELSE `body` END,
	CASE WHEN `starred` THEN `body` END,
	`created_at`,
	max(`updated_at`, coalesce(`log_updated_at`, `updated_at`))
FROM (
	SELECT
		m.`id`,
		m.`user_id`,
		m.`project_id`,
		m.`body`,
		m.`created_at`,
		m.`updated_at`,
		sl.`situation` AS `s`,
		sl.`task` AS `t`,
		sl.`action` AS `a`,
		sl.`result` AS `r`,
		sl.`updated_at` AS `log_updated_at`,
		(
			coalesce(trim(sl.`situation`), '') <> ''
			OR coalesce(trim(sl.`task`), '') <> ''
			OR coalesce(trim(sl.`action`), '') <> ''
			OR coalesce(trim(sl.`result`), '') <> ''
		) AS `starred`
	FROM `memos` m
	LEFT JOIN `star_logs` sl ON sl.`memo_id` = m.`id`
);
--> statement-breakpoint
INSERT INTO `star_tags` (`star_id`, `tag_id`) SELECT `memo_id`, `tag_id` FROM `memo_tags`;
