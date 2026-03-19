import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestContext } from '$lib/server/testing/setup';

async function enableDriverMessaging(
	db: Awaited<ReturnType<typeof createTestContext>>['db'],
	schema: Awaited<ReturnType<typeof createTestContext>>['schema']
) {
	const drivers = await db.select().from(schema.drivers);
	const vehicles = await db.select().from(schema.vehicles);

	for (const driver of drivers) {
		const vehicle = vehicles.find((entry) => entry.driverId === driver.id);

		await db
			.update(schema.drivers)
			.set({
				whatsappJid: `${String(driver.phone ?? '').replace(/\D/g, '')}@c.us`
			})
			.where(eq(schema.drivers.id, driver.id));

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
}

function createAdminEvent(body: unknown) {
	return {
		locals: {
			user: {
				id: 'admin-user',
				role: 'admin'
			}
		},
		request: new Request('http://localhost/admin/integrations/whatsapp/test-webhook', {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify(body)
		})
	};
}

describe('simulateTestWebhookInbound', () => {
	beforeEach(() => {
		process.env.DEFAULT_ADMIN_EMAIL = 'admin@example.com';
		process.env.DEFAULT_ADMIN_PASSWORD = 'admin1234';
		process.env.DEFAULT_DRIVER_PASSWORD = 'driver1234';
	});

	it('works even when live WhatsApp is not configured or running', async () => {
		const { db, schema } = await createTestContext();
		const { simulateTestWebhookInbound } = await import('./test-webhook');
		const [connection] = await db
			.select()
			.from(schema.integrationConnections)
			.where(eq(schema.integrationConnections.providerKey, 'whatsapp-web'))
			.limit(1);

		const result = await simulateTestWebhookInbound({
			phoneNumber: '+263 700 123 456',
			messageBody: 'hello'
		});

		expect(connection?.status).toBe('stopped');
		expect(result.session?.state).toBe('awaiting_size');
		expect(result.order?.status).toBe('draft');
		expect(result.responses).toEqual([
			expect.objectContaining({
				toJid: '263700123456@c.us',
				kind: 'text',
				body: expect.stringContaining('Welcome to Courier Service.')
			})
		]);
	});

	it('runs the full menu flow and captures the resulting customer and driver messages', async () => {
		const context = await createTestContext();
		const { simulateTestWebhookInbound } = await import('./test-webhook');
		await enableDriverMessaging(context.db, context.schema);

		await simulateTestWebhookInbound({
			phoneNumber: '+263700123456',
			messageBody: 'hi'
		});
		await simulateTestWebhookInbound({
			phoneNumber: '+263700123456',
			messageBody: '2'
		});
		await simulateTestWebhookInbound({
			phoneNumber: '+263700123456',
			messageBody: '20x20x10'
		});
		await simulateTestWebhookInbound({
			phoneNumber: '+263700123456',
			messageBody: '2'
		});
		await simulateTestWebhookInbound({
			phoneNumber: '+263700123456',
			location: { latitude: -17.829, longitude: 31.052, name: 'Pickup' }
		});
		await simulateTestWebhookInbound({
			phoneNumber: '+263700123456',
			location: { latitude: -17.905, longitude: 31.111, name: 'Dropoff' }
		});
		await simulateTestWebhookInbound({
			phoneNumber: '+263700123456',
			messageBody: 'Fragile'
		});
		const result = await simulateTestWebhookInbound({
			phoneNumber: '+263700123456',
			messageBody: '1'
		});

		expect(result.session?.state).toBe('completed');
		expect(result.order?.status).toBe('offered');
		expect(
			result.responses.some(
				(response) =>
					response.toJid === '263700123456@c.us' &&
					response.body?.includes('Request confirmed. We are offering your job')
			)
		).toBe(true);
		expect(
			result.responses.some(
				(response) =>
					response.toJid.endsWith('@c.us') && response.body?.includes('New courier offer:')
			)
		).toBe(true);
	});

	it('exposes the HTTP endpoint for authenticated admins', async () => {
		await createTestContext();
		const { POST } =
			await import('../../../routes/admin/integrations/whatsapp/test-webhook/+server');

		const response = await POST(
			createAdminEvent({
				phoneNumber: '+263700123456',
				messageBody: 'hello'
			}) as Parameters<typeof POST>[0]
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.session.state).toBe('awaiting_size');
		expect(body.responses[0].body).toContain('Welcome to Courier Service.');
	});
});
