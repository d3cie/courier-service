import { and, asc, eq, lte } from 'drizzle-orm';

import { db } from '$lib/server/db/client';
import {
	conversationSessions,
	integrationConnections,
	messageEvents,
	outboxMessages,
	type MessageType
} from '$lib/server/db/schema';
import type {
	MessagingConnectionSnapshot,
	NormalizedInboundMessage,
	NormalizedLocation
} from '$lib/server/messaging/types';

function nowIso() {
	return new Date().toISOString();
}

export async function logInboundMessage(
	message: NormalizedInboundMessage,
	options: { conversationSessionId?: string | null; orderId?: string | null } = {}
) {
	await db.insert(messageEvents).values({
		direction: 'inbound',
		provider: message.providerKey,
		externalMessageId: message.externalMessageId,
		conversationSessionId: options.conversationSessionId ?? null,
		orderId: options.orderId ?? null,
		customerJid: message.fromJid,
		messageType: message.type,
		body: message.text ?? null,
		payloadJson: JSON.stringify(message.raw)
	});
}

export async function logOutboundMessage(options: {
	provider: string;
	externalMessageId?: string | null;
	conversationSessionId?: string | null;
	orderId?: string | null;
	customerJid: string;
	messageType: MessageType;
	body?: string | null;
	payloadJson?: string | null;
}) {
	await db.insert(messageEvents).values({
		direction: 'outbound',
		provider: options.provider,
		externalMessageId: options.externalMessageId ?? null,
		conversationSessionId: options.conversationSessionId ?? null,
		orderId: options.orderId ?? null,
		customerJid: options.customerJid,
		messageType: options.messageType,
		body: options.body ?? null,
		payloadJson: options.payloadJson ?? null
	});
}

async function touchConversation(sessionId: string | null | undefined) {
	if (!sessionId) {
		return;
	}

	await db
		.update(conversationSessions)
		.set({ latestOutboundAt: nowIso(), updatedAt: nowIso() })
		.where(eq(conversationSessions.id, sessionId));
}

export async function queueTextMessage(options: {
	toJid: string;
	body: string;
	orderId?: string | null;
	conversationSessionId?: string | null;
	dedupeKey?: string | null;
}) {
	const payload = {
		toJid: options.toJid,
		body: options.body,
		kind: 'text' as const,
		orderId: options.orderId ?? null,
		conversationSessionId: options.conversationSessionId ?? null,
		dedupeKey: options.dedupeKey ?? null
	};

	const query = db.insert(outboxMessages).values(payload);

	if (options.dedupeKey) {
		await query.onConflictDoNothing({ target: outboxMessages.dedupeKey });
	} else {
		await query;
	}

	await touchConversation(options.conversationSessionId);
}

export async function queueLocationMessage(options: {
	toJid: string;
	location: NormalizedLocation;
	orderId?: string | null;
	conversationSessionId?: string | null;
	dedupeKey?: string | null;
}) {
	const query = db.insert(outboxMessages).values({
		toJid: options.toJid,
		kind: 'location',
		locationLatitude: options.location.latitude,
		locationLongitude: options.location.longitude,
		locationName: options.location.name ?? null,
		body: options.location.address ?? null,
		orderId: options.orderId ?? null,
		conversationSessionId: options.conversationSessionId ?? null,
		dedupeKey: options.dedupeKey ?? null
	});

	if (options.dedupeKey) {
		await query.onConflictDoNothing({ target: outboxMessages.dedupeKey });
	} else {
		await query;
	}

	await touchConversation(options.conversationSessionId);
}

export async function loadDueOutboxMessages(limit = 20) {
	return db
		.select()
		.from(outboxMessages)
		.where(and(eq(outboxMessages.status, 'pending'), lte(outboxMessages.availableAt, nowIso())))
		.orderBy(asc(outboxMessages.availableAt))
		.limit(limit);
}

export async function markOutboxProcessing(messageId: string) {
	await db
		.update(outboxMessages)
		.set({ status: 'processing', updatedAt: nowIso() })
		.where(and(eq(outboxMessages.id, messageId), eq(outboxMessages.status, 'pending')));
}

export async function markOutboxSent(messageId: string) {
	await db
		.update(outboxMessages)
		.set({ status: 'sent', sentAt: nowIso(), updatedAt: nowIso() })
		.where(eq(outboxMessages.id, messageId));
}

export async function markOutboxFailed(
	messageId: string,
	currentAttempts: number,
	errorMessage: string
) {
	const retryDelayMs = Math.min(60_000 * Math.max(currentAttempts + 1, 1), 15 * 60_000);

	await db
		.update(outboxMessages)
		.set({
			status: 'pending',
			attempts: currentAttempts + 1,
			lastError: errorMessage.slice(0, 500),
			availableAt: new Date(Date.now() + retryDelayMs).toISOString(),
			updatedAt: nowIso()
		})
		.where(eq(outboxMessages.id, messageId));
}

export async function updateIntegrationState(snapshot: MessagingConnectionSnapshot) {
	await db
		.insert(integrationConnections)
		.values({
			providerKey: snapshot.providerKey,
			status: snapshot.status,
			qrCode: snapshot.qrCode,
			lastReadyAt: snapshot.lastReadyAt,
			lastDisconnectAt: snapshot.lastDisconnectAt,
			lastSyncAt: snapshot.lastSyncAt,
			lastError: snapshot.lastError,
			updatedAt: snapshot.updatedAt
		})
		.onConflictDoUpdate({
			target: integrationConnections.providerKey,
			set: {
				status: snapshot.status,
				qrCode: snapshot.qrCode,
				lastReadyAt: snapshot.lastReadyAt,
				lastDisconnectAt: snapshot.lastDisconnectAt,
				lastSyncAt: snapshot.lastSyncAt,
				lastError: snapshot.lastError,
				updatedAt: snapshot.updatedAt
			}
		});
}
