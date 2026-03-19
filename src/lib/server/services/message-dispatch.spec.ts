import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestContext } from '$lib/server/testing/setup';

describe('dispatchDueOutboxMessages', () => {
	beforeEach(() => {
		process.env.DEFAULT_ADMIN_EMAIL = 'admin@example.com';
		process.env.DEFAULT_ADMIN_PASSWORD = 'admin1234';
		process.env.DEFAULT_DRIVER_PASSWORD = 'driver1234';
	});

	it('only dispatches the requested outbox channel', async () => {
		const { db, schema } = await createTestContext();
		const testChannel = 'test-webhook:request-1';
		const { FakeMessagingProvider } = await import('$lib/server/messaging/fake-provider');
		const { dispatchDueOutboxMessages } = await import('./message-dispatch');
		const { queueTextMessage } = await import('./outbox');

		await queueTextMessage({
			channel: 'whatsapp',
			toJid: '263700999001@c.us',
			body: 'real whatsapp delivery'
		});
		await queueTextMessage({
			channel: testChannel,
			toJid: '263700999002@c.us',
			body: 'captured webhook delivery'
		});

		const provider = new FakeMessagingProvider('test-webhook');
		await provider.start();
		const dispatched = await dispatchDueOutboxMessages(provider, {
			channel: testChannel,
			limit: 10
		});

		const rows = await db.select().from(schema.outboxMessages);
		const liveRow = rows.find((row) => row.channel === 'whatsapp');
		const testRow = rows.find((row) => row.channel === testChannel);
		const [loggedOutbound] = await db
			.select()
			.from(schema.messageEvents)
			.where(eq(schema.messageEvents.customerJid, '263700999002@c.us'))
			.limit(1);

		expect(dispatched).toHaveLength(1);
		expect(provider.sent).toEqual([
			{
				toJid: '263700999002@c.us',
				kind: 'text',
				body: 'captured webhook delivery'
			}
		]);
		expect(liveRow?.status).toBe('pending');
		expect(testRow?.status).toBe('sent');
		expect(loggedOutbound?.provider).toBe('test-webhook');
	});
});
