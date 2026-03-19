CREATE TABLE `assignment_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`driver_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`rank` integer NOT NULL,
	`capacity_tier` integer NOT NULL,
	`capacity_waste_cm3` integer NOT NULL,
	`distance_meters` integer NOT NULL,
	`idle_seconds` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assignment_candidates_order_rank_idx` ON `assignment_candidates` (`order_id`,`rank`);--> statement-breakpoint
CREATE INDEX `assignment_candidates_driver_idx` ON `assignment_candidates` (`driver_id`);--> statement-breakpoint
CREATE TABLE `assignment_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`assignment_candidate_id` text NOT NULL,
	`driver_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`offered_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`responded_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignment_candidate_id`) REFERENCES `assignment_candidates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assignment_offers_driver_status_idx` ON `assignment_offers` (`driver_id`,`status`);--> statement-breakpoint
CREATE INDEX `assignment_offers_order_status_idx` ON `assignment_offers` (`order_id`,`status`);--> statement-breakpoint
CREATE TABLE `conversation_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_jid` text NOT NULL,
	`customer_phone` text,
	`state` text NOT NULL,
	`order_id` text,
	`context_json` text DEFAULT '{}' NOT NULL,
	`latest_inbound_at` text,
	`latest_outbound_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_sessions_customer_jid_unique` ON `conversation_sessions` (`customer_jid`);--> statement-breakpoint
CREATE TABLE `driver_availability` (
	`id` text PRIMARY KEY NOT NULL,
	`driver_id` text NOT NULL,
	`is_online` integer DEFAULT false NOT NULL,
	`availability_status` text DEFAULT 'offline' NOT NULL,
	`active_vehicle_id` text,
	`current_latitude` real,
	`current_longitude` real,
	`last_location_at` text,
	`last_status_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`active_vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `driver_availability_driver_id_unique` ON `driver_availability` (`driver_id`);--> statement-breakpoint
CREATE TABLE `drivers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`phone` text,
	`whatsapp_jid` text,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drivers_user_id_unique` ON `drivers` (`user_id`);--> statement-breakpoint
CREATE TABLE `integration_connections` (
	`provider_key` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`qr_code` text,
	`last_ready_at` text,
	`last_disconnect_at` text,
	`last_sync_at` text,
	`last_error` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `message_events` (
	`id` text PRIMARY KEY NOT NULL,
	`direction` text NOT NULL,
	`provider` text NOT NULL,
	`external_message_id` text,
	`conversation_session_id` text,
	`order_id` text,
	`customer_jid` text,
	`message_type` text NOT NULL,
	`body` text,
	`payload_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`conversation_session_id`) REFERENCES `conversation_sessions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `message_events_order_idx` ON `message_events` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`kind` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`name` text,
	`address` text,
	`url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_locations_order_kind_unique` ON `order_locations` (`order_id`,`kind`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_jid` text NOT NULL,
	`customer_phone` text,
	`customer_name` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`package_preset_id` text,
	`package_length_cm` integer,
	`package_width_cm` integer,
	`package_height_cm` integer,
	`package_weight_kg` real,
	`package_volume_cm3` integer,
	`notes` text,
	`assigned_driver_id` text,
	`assigned_vehicle_id` text,
	`customer_confirmed_at` text,
	`dispatch_started_at` text,
	`delivered_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`package_preset_id`) REFERENCES `package_size_presets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assigned_driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assigned_vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_customer_jid_idx` ON `orders` (`customer_jid`);--> statement-breakpoint
CREATE TABLE `outbox_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text DEFAULT 'whatsapp' NOT NULL,
	`to_jid` text NOT NULL,
	`kind` text NOT NULL,
	`body` text,
	`location_latitude` real,
	`location_longitude` real,
	`location_name` text,
	`order_id` text,
	`conversation_session_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`dedupe_key` text,
	`available_at` text NOT NULL,
	`sent_at` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`conversation_session_id`) REFERENCES `conversation_sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `outbox_messages_status_available_idx` ON `outbox_messages` (`status`,`available_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `outbox_messages_dedupe_key_unique` ON `outbox_messages` (`dedupe_key`);--> statement-breakpoint
CREATE TABLE `package_size_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`description` text NOT NULL,
	`sort_order` integer NOT NULL,
	`max_length_cm` integer NOT NULL,
	`max_width_cm` integer NOT NULL,
	`max_height_cm` integer NOT NULL,
	`max_weight_kg` real NOT NULL,
	`max_volume_cm3` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `package_size_presets_key_unique` ON `package_size_presets` (`key`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`driver_id` text NOT NULL,
	`name` text NOT NULL,
	`registration_number` text,
	`template_key` text NOT NULL,
	`capacity_tier` integer NOT NULL,
	`max_length_cm` integer NOT NULL,
	`max_width_cm` integer NOT NULL,
	`max_height_cm` integer NOT NULL,
	`max_weight_kg` real NOT NULL,
	`max_volume_cm3` integer NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `vehicles_driver_id_idx` ON `vehicles` (`driver_id`);