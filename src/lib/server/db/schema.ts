import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const id = () => randomUUID();
const now = () => new Date().toISOString();

export type UserRole = 'admin' | 'driver';
export type DriverAvailabilityStatus = 'offline' | 'idle' | 'offered' | 'assigned';
export type DriverProfileStatus = 'active' | 'inactive';
export type OrderStatus =
	| 'draft'
	| 'awaiting_confirmation'
	| 'dispatching'
	| 'offered'
	| 'accepted'
	| 'arriving_pickup'
	| 'picked_up'
	| 'in_transit'
	| 'delivered'
	| 'manual_review'
	| 'cancelled';
export type ConversationState =
	| 'awaiting_size'
	| 'awaiting_dimensions'
	| 'awaiting_weight'
	| 'awaiting_pickup_location'
	| 'awaiting_dropoff_location'
	| 'awaiting_notes'
	| 'awaiting_confirmation'
	| 'completed'
	| 'cancelled';
export type LocationKind = 'pickup' | 'dropoff';
export type CandidateStatus =
	| 'pending'
	| 'offered'
	| 'accepted'
	| 'rejected'
	| 'expired'
	| 'skipped';
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageType = 'text' | 'location' | 'unknown';
export type OutboxStatus = 'pending' | 'processing' | 'sent' | 'failed';
export type ProviderConnectionStatus =
	| 'stopped'
	| 'starting'
	| 'qr_ready'
	| 'ready'
	| 'disconnected'
	| 'error';

export const users = sqliteTable(
	'users',
	{
		id: text('id').primaryKey().$defaultFn(id),
		name: text('name').notNull(),
		email: text('email').notNull(),
		phone: text('phone'),
		passwordHash: text('password_hash').notNull(),
		role: text('role').$type<UserRole>().notNull(),
		createdAt: text('created_at').notNull().$defaultFn(now),
		updatedAt: text('updated_at').notNull().$defaultFn(now)
	},
	(table) => [uniqueIndex('users_email_unique').on(table.email)]
);

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey().$defaultFn(id),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		tokenHash: text('token_hash').notNull(),
		expiresAt: text('expires_at').notNull(),
		createdAt: text('created_at').notNull().$defaultFn(now)
	},
	(table) => [uniqueIndex('sessions_token_hash_unique').on(table.tokenHash)]
);

export const drivers = sqliteTable(
	'drivers',
	{
		id: text('id').primaryKey().$defaultFn(id),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		displayName: text('display_name').notNull(),
		phone: text('phone'),
		whatsappJid: text('whatsapp_jid'),
		status: text('status').$type<DriverProfileStatus>().notNull().default('active'),
		notes: text('notes'),
		createdAt: text('created_at').notNull().$defaultFn(now),
		updatedAt: text('updated_at').notNull().$defaultFn(now)
	},
	(table) => [uniqueIndex('drivers_user_id_unique').on(table.userId)]
);

export const vehicles = sqliteTable(
	'vehicles',
	{
		id: text('id').primaryKey().$defaultFn(id),
		driverId: text('driver_id')
			.notNull()
			.references(() => drivers.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		registrationNumber: text('registration_number'),
		templateKey: text('template_key').notNull(),
		capacityTier: integer('capacity_tier').notNull(),
		maxLengthCm: integer('max_length_cm').notNull(),
		maxWidthCm: integer('max_width_cm').notNull(),
		maxHeightCm: integer('max_height_cm').notNull(),
		maxWeightKg: real('max_weight_kg').notNull(),
		maxVolumeCm3: integer('max_volume_cm3').notNull(),
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
		createdAt: text('created_at').notNull().$defaultFn(now),
		updatedAt: text('updated_at').notNull().$defaultFn(now)
	},
	(table) => [index('vehicles_driver_id_idx').on(table.driverId)]
);

export const driverAvailability = sqliteTable(
	'driver_availability',
	{
		id: text('id').primaryKey().$defaultFn(id),
		driverId: text('driver_id')
			.notNull()
			.references(() => drivers.id, { onDelete: 'cascade' }),
		isOnline: integer('is_online', { mode: 'boolean' }).notNull().default(false),
		availabilityStatus: text('availability_status')
			.$type<DriverAvailabilityStatus>()
			.notNull()
			.default('offline'),
		activeVehicleId: text('active_vehicle_id').references(() => vehicles.id, {
			onDelete: 'set null'
		}),
		currentLatitude: real('current_latitude'),
		currentLongitude: real('current_longitude'),
		lastLocationAt: text('last_location_at'),
		lastStatusAt: text('last_status_at').notNull().$defaultFn(now),
		updatedAt: text('updated_at').notNull().$defaultFn(now)
	},
	(table) => [uniqueIndex('driver_availability_driver_id_unique').on(table.driverId)]
);

export const packageSizePresets = sqliteTable(
	'package_size_presets',
	{
		id: text('id').primaryKey().$defaultFn(id),
		key: text('key').notNull(),
		label: text('label').notNull(),
		description: text('description').notNull(),
		sortOrder: integer('sort_order').notNull(),
		maxLengthCm: integer('max_length_cm').notNull(),
		maxWidthCm: integer('max_width_cm').notNull(),
		maxHeightCm: integer('max_height_cm').notNull(),
		maxWeightKg: real('max_weight_kg').notNull(),
		maxVolumeCm3: integer('max_volume_cm3').notNull(),
		createdAt: text('created_at').notNull().$defaultFn(now)
	},
	(table) => [uniqueIndex('package_size_presets_key_unique').on(table.key)]
);

export const orders = sqliteTable(
	'orders',
	{
		id: text('id').primaryKey().$defaultFn(id),
		customerJid: text('customer_jid').notNull(),
		customerPhone: text('customer_phone'),
		customerName: text('customer_name'),
		status: text('status').$type<OrderStatus>().notNull().default('draft'),
		packagePresetId: text('package_preset_id').references(() => packageSizePresets.id, {
			onDelete: 'set null'
		}),
		packageLengthCm: integer('package_length_cm'),
		packageWidthCm: integer('package_width_cm'),
		packageHeightCm: integer('package_height_cm'),
		packageWeightKg: real('package_weight_kg'),
		packageVolumeCm3: integer('package_volume_cm3'),
		notes: text('notes'),
		assignedDriverId: text('assigned_driver_id').references(() => drivers.id, {
			onDelete: 'set null'
		}),
		assignedVehicleId: text('assigned_vehicle_id').references(() => vehicles.id, {
			onDelete: 'set null'
		}),
		customerConfirmedAt: text('customer_confirmed_at'),
		dispatchStartedAt: text('dispatch_started_at'),
		deliveredAt: text('delivered_at'),
		createdAt: text('created_at').notNull().$defaultFn(now),
		updatedAt: text('updated_at').notNull().$defaultFn(now)
	},
	(table) => [
		index('orders_status_idx').on(table.status),
		index('orders_customer_jid_idx').on(table.customerJid)
	]
);

export const orderLocations = sqliteTable(
	'order_locations',
	{
		id: text('id').primaryKey().$defaultFn(id),
		orderId: text('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		kind: text('kind').$type<LocationKind>().notNull(),
		latitude: real('latitude').notNull(),
		longitude: real('longitude').notNull(),
		name: text('name'),
		address: text('address'),
		url: text('url'),
		createdAt: text('created_at').notNull().$defaultFn(now),
		updatedAt: text('updated_at').notNull().$defaultFn(now)
	},
	(table) => [uniqueIndex('order_locations_order_kind_unique').on(table.orderId, table.kind)]
);

export const assignmentCandidates = sqliteTable(
	'assignment_candidates',
	{
		id: text('id').primaryKey().$defaultFn(id),
		orderId: text('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		driverId: text('driver_id')
			.notNull()
			.references(() => drivers.id, { onDelete: 'cascade' }),
		vehicleId: text('vehicle_id')
			.notNull()
			.references(() => vehicles.id, { onDelete: 'cascade' }),
		rank: integer('rank').notNull(),
		capacityTier: integer('capacity_tier').notNull(),
		capacityWasteCm3: integer('capacity_waste_cm3').notNull(),
		distanceMeters: integer('distance_meters').notNull(),
		idleSeconds: integer('idle_seconds').notNull(),
		status: text('status').$type<CandidateStatus>().notNull().default('pending'),
		createdAt: text('created_at').notNull().$defaultFn(now),
		updatedAt: text('updated_at').notNull().$defaultFn(now)
	},
	(table) => [
		index('assignment_candidates_order_rank_idx').on(table.orderId, table.rank),
		index('assignment_candidates_driver_idx').on(table.driverId)
	]
);

export const assignmentOffers = sqliteTable(
	'assignment_offers',
	{
		id: text('id').primaryKey().$defaultFn(id),
		orderId: text('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		assignmentCandidateId: text('assignment_candidate_id')
			.notNull()
			.references(() => assignmentCandidates.id, { onDelete: 'cascade' }),
		driverId: text('driver_id')
			.notNull()
			.references(() => drivers.id, { onDelete: 'cascade' }),
		vehicleId: text('vehicle_id')
			.notNull()
			.references(() => vehicles.id, { onDelete: 'cascade' }),
		status: text('status').$type<OfferStatus>().notNull().default('pending'),
		offeredAt: text('offered_at').notNull(),
		expiresAt: text('expires_at').notNull(),
		respondedAt: text('responded_at'),
		createdAt: text('created_at').notNull().$defaultFn(now),
		updatedAt: text('updated_at').notNull().$defaultFn(now)
	},
	(table) => [
		index('assignment_offers_driver_status_idx').on(table.driverId, table.status),
		index('assignment_offers_order_status_idx').on(table.orderId, table.status)
	]
);

export const conversationSessions = sqliteTable(
	'conversation_sessions',
	{
		id: text('id').primaryKey().$defaultFn(id),
		customerJid: text('customer_jid').notNull(),
		customerPhone: text('customer_phone'),
		state: text('state').$type<ConversationState>().notNull(),
		orderId: text('order_id').references(() => orders.id, { onDelete: 'set null' }),
		contextJson: text('context_json')
			.notNull()
			.default(sql`'{}'`),
		latestInboundAt: text('latest_inbound_at'),
		latestOutboundAt: text('latest_outbound_at'),
		createdAt: text('created_at').notNull().$defaultFn(now),
		updatedAt: text('updated_at').notNull().$defaultFn(now)
	},
	(table) => [uniqueIndex('conversation_sessions_customer_jid_unique').on(table.customerJid)]
);

export const messageEvents = sqliteTable(
	'message_events',
	{
		id: text('id').primaryKey().$defaultFn(id),
		direction: text('direction').$type<MessageDirection>().notNull(),
		provider: text('provider').notNull(),
		externalMessageId: text('external_message_id'),
		conversationSessionId: text('conversation_session_id').references(
			() => conversationSessions.id,
			{
				onDelete: 'set null'
			}
		),
		orderId: text('order_id').references(() => orders.id, { onDelete: 'set null' }),
		customerJid: text('customer_jid'),
		messageType: text('message_type').$type<MessageType>().notNull(),
		body: text('body'),
		payloadJson: text('payload_json'),
		createdAt: text('created_at').notNull().$defaultFn(now)
	},
	(table) => [index('message_events_order_idx').on(table.orderId)]
);

export const outboxMessages = sqliteTable(
	'outbox_messages',
	{
		id: text('id').primaryKey().$defaultFn(id),
		channel: text('channel').notNull().default('whatsapp'),
		toJid: text('to_jid').notNull(),
		kind: text('kind').$type<'text' | 'location'>().notNull(),
		body: text('body'),
		locationLatitude: real('location_latitude'),
		locationLongitude: real('location_longitude'),
		locationName: text('location_name'),
		orderId: text('order_id').references(() => orders.id, { onDelete: 'set null' }),
		conversationSessionId: text('conversation_session_id').references(
			() => conversationSessions.id,
			{
				onDelete: 'set null'
			}
		),
		status: text('status').$type<OutboxStatus>().notNull().default('pending'),
		attempts: integer('attempts').notNull().default(0),
		dedupeKey: text('dedupe_key'),
		availableAt: text('available_at').notNull().$defaultFn(now),
		sentAt: text('sent_at'),
		lastError: text('last_error'),
		createdAt: text('created_at').notNull().$defaultFn(now),
		updatedAt: text('updated_at').notNull().$defaultFn(now)
	},
	(table) => [
		index('outbox_messages_status_available_idx').on(table.status, table.availableAt),
		uniqueIndex('outbox_messages_dedupe_key_unique').on(table.dedupeKey)
	]
);

export const integrationConnections = sqliteTable('integration_connections', {
	providerKey: text('provider_key').primaryKey(),
	status: text('status').$type<ProviderConnectionStatus>().notNull(),
	qrCode: text('qr_code'),
	lastReadyAt: text('last_ready_at'),
	lastDisconnectAt: text('last_disconnect_at'),
	lastSyncAt: text('last_sync_at'),
	lastError: text('last_error'),
	updatedAt: text('updated_at').notNull().$defaultFn(now)
});
