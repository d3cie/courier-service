import { desc, eq } from 'drizzle-orm';

import { db } from '$lib/server/db/client';
import { integrationConnections, messageEvents, outboxMessages } from '$lib/server/db/schema';

export const load = async () => {
	const [connection] = await db
		.select()
		.from(integrationConnections)
		.where(eq(integrationConnections.providerKey, 'whatsapp-web'))
		.limit(1);

	const recentMessages = await db
		.select()
		.from(messageEvents)
		.orderBy(desc(messageEvents.createdAt))
		.limit(12);

	const recentOutbox = await db
		.select()
		.from(outboxMessages)
		.orderBy(desc(outboxMessages.updatedAt))
		.limit(12);

	return {
		connection,
		recentMessages,
		recentOutbox
	};
};
