CREATE INDEX `follows_list` ON `follows` (`wishlist_id`);--> statement-breakpoint
CREATE INDEX `password_resets_user` ON `password_resets` (`user_id`);--> statement-breakpoint
CREATE INDEX `password_resets_expiry` ON `password_resets` (`expires_at`);--> statement-breakpoint
CREATE INDEX `rate_limits_expiry` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE INDEX `reservations_user` ON `reservations` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);