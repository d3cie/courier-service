import { and, desc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestContext } from '$lib/server/testing/setup';

function createInbound(
	id: number,
	overrides: Partial<{
		type: 'text' | 'location' | 'unknown';
		text: string;
		location: {
			latitude: number;
			longitude: number;
			name?: string;
			address?: string;
		};
	}>
) {
	return {
		providerKey: 'fake-whatsapp',
		externalMessageId: `msg-${id}`,
		fromJid: '263700123456@c.us',
		fromPhone: '263700123456',
		type: overrides.type ?? 'text',
		text: overrides.text,
		location: overrides.location,
		receivedAt: new Date(Date.now() + id * 1000).toISOString(),
		raw: overrides
	};
}

describe('OrderIntakeService', () => {
	beforeEach(() => {
		process.env.DEFAULT_ADMIN_EMAIL = 'admin@example.com';
		process.env.DEFAULT_ADMIN_PASSWORD = 'admin1234';
		process.env.DEFAULT_DRIVER_PASSWORD = 'driver1234';
	});

	it('creates a dispatchable order and opens an assignment offer after confirmation', async () => {
		const { db, schema, services } = await createTestContext();
		const drivers = await db.select().from(schema.drivers);
		const vehicles = await db.select().from(schema.vehicles);

		for (const driver of drivers) {
			const vehicle = vehicles.find((entry) => entry.driverId === driver.id);
			await db
				.update(schema.driverAvailability)
				.set({
					isOnline: true,
					availabilityStatus: 'idle',
					activeVehicleId: vehicle?.id ?? null,
					currentLatitude: -17.829,
					currentLongitude: 31.052,
					lastLocationAt: new Date().toISOString(),
					lastStatusAt: new Date(Date.now() - 15 * 60_000).toISOString(),
					updatedAt: new Date().toISOString()
				})
				.where(eq(schema.driverAvailability.driverId, driver.id));
		}

		await services.orderIntakeService.handleInboundMessage(createInbound(1, { text: 'hi' }));
		await services.orderIntakeService.handleInboundMessage(createInbound(2, { text: '2' }));
		await services.orderIntakeService.handleInboundMessage(createInbound(3, { text: '20x20x10' }));
		await services.orderIntakeService.handleInboundMessage(createInbound(4, { text: '2' }));
		await services.orderIntakeService.handleInboundMessage(
			createInbound(5, {
				type: 'location',
				location: { latitude: -17.829, longitude: 31.052, name: 'Pickup' }
			})
		);
		await services.orderIntakeService.handleInboundMessage(
			createInbound(6, {
				type: 'location',
				location: { latitude: -17.905, longitude: 31.111, name: 'Dropoff' }
			})
		);
		await services.orderIntakeService.handleInboundMessage(createInbound(7, { text: 'Fragile' }));
		await services.orderIntakeService.handleInboundMessage(createInbound(8, { text: '1' }));

		const [session] = await db
			.select()
			.from(schema.conversationSessions)
			.where(eq(schema.conversationSessions.customerJid, '263700123456@c.us'))
			.limit(1);
		const [order] = await db
			.select()
			.from(schema.orders)
			.where(eq(schema.orders.id, session.orderId!))
			.limit(1);
		const [offer] = await db
			.select()
			.from(schema.assignmentOffers)
			.where(
				and(
					eq(schema.assignmentOffers.orderId, order.id),
					eq(schema.assignmentOffers.status, 'pending')
				)
			)
			.limit(1);
		const outbox = await db
			.select()
			.from(schema.outboxMessages)
			.orderBy(desc(schema.outboxMessages.createdAt));

		expect(session.state).toBe('completed');
		expect(order.status).toBe('offered');
		expect(order.notes).toBe('Fragile');
		expect(offer).toBeTruthy();
		expect(outbox[0].body).toContain('Request confirmed');
	});

	it('keeps the flow waiting for a pickup pin when plain text is sent instead of a location', async () => {
		const { db, schema, services } = await createTestContext();

		await services.orderIntakeService.handleInboundMessage(createInbound(1, { text: 'hi' }));
		await services.orderIntakeService.handleInboundMessage(createInbound(2, { text: '2' }));
		await services.orderIntakeService.handleInboundMessage(createInbound(3, { text: '20x20x10' }));
		await services.orderIntakeService.handleInboundMessage(createInbound(4, { text: '2' }));
		await services.orderIntakeService.handleInboundMessage(
			createInbound(5, { text: 'near the mall' })
		);

		const [session] = await db
			.select()
			.from(schema.conversationSessions)
			.where(eq(schema.conversationSessions.customerJid, '263700123456@c.us'))
			.limit(1);
		const [latestOutbox] = await db
			.select()
			.from(schema.outboxMessages)
			.orderBy(desc(schema.outboxMessages.createdAt))
			.limit(1);

		expect(session.state).toBe('awaiting_pickup_location');
		expect(latestOutbox.body).toContain('pickup location pin');
	});
});
