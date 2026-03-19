import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '$lib/server/db/client';
import { conversationSessions, orders } from '$lib/server/db/schema';
import { createCourierServices } from '$lib/server/services/container';
import { dispatchDueOutboxMessages } from '$lib/server/services/message-dispatch';

import { FakeMessagingProvider } from './fake-provider';
import type { NormalizedInboundMessage } from './types';

function nowIso() {
	return new Date().toISOString();
}

const locationSchema = z.object({
	latitude: z.number().finite(),
	longitude: z.number().finite(),
	name: z.string().trim().min(1).optional(),
	address: z.string().trim().min(1).optional(),
	url: z.string().trim().url().optional()
});

export const testWebhookPayloadSchema = z
	.object({
		phoneNumber: z.string().trim().min(1),
		messageBody: z.string().trim().optional(),
		location: locationSchema.optional()
	})
	.superRefine((value, context) => {
		if (!value.messageBody && !value.location) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Provide either messageBody or location.'
			});
		}
	});

export type TestWebhookPayload = z.infer<typeof testWebhookPayloadSchema>;

export function normalizeTestPhoneNumber(phoneNumber: string) {
	const normalized = phoneNumber.replace(/\D/g, '');

	if (!normalized) {
		throw new Error('Phone number must contain at least one digit.');
	}

	return normalized;
}

export async function simulateTestWebhookInbound(payload: TestWebhookPayload) {
	const phoneNumber = normalizeTestPhoneNumber(payload.phoneNumber);
	const fromJid = `${phoneNumber}@c.us`;
	const channel = `test-webhook:${randomUUID()}`;
	const services = createCourierServices({ messageChannel: channel });
	const inbound: NormalizedInboundMessage = {
		providerKey: 'test-webhook',
		externalMessageId: `test-${randomUUID()}`,
		fromJid,
		fromPhone: phoneNumber,
		type: payload.location ? 'location' : 'text',
		text: payload.location ? undefined : payload.messageBody,
		location: payload.location,
		receivedAt: nowIso(),
		raw: payload
	};

	await services.orderIntakeService.handleInboundMessage(inbound);

	const captureProvider = new FakeMessagingProvider('test-webhook');
	await captureProvider.start();
	await dispatchDueOutboxMessages(captureProvider, { channel, limit: 20 });
	await captureProvider.stop();

	const [session] = await db
		.select()
		.from(conversationSessions)
		.where(eq(conversationSessions.customerJid, fromJid))
		.limit(1);
	const [order] = session?.orderId
		? await db.select().from(orders).where(eq(orders.id, session.orderId)).limit(1)
		: [];

	return {
		inbound: {
			phoneNumber,
			type: inbound.type,
			text: inbound.text,
			location: inbound.location
		},
		session: session
			? {
					id: session.id,
					state: session.state,
					orderId: session.orderId
				}
			: null,
		order: order
			? {
					id: order.id,
					status: order.status
				}
			: null,
		responses: captureProvider.sent
	};
}
