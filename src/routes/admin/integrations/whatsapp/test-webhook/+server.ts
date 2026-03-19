import { json } from '@sveltejs/kit';

import { requireRole } from '$lib/server/auth/guards';
import {
	simulateTestWebhookInbound,
	testWebhookPayloadSchema
} from '$lib/server/messaging/test-webhook';

export const POST = async (event) => {
	requireRole(event, 'admin');

	const payload = testWebhookPayloadSchema.safeParse(await event.request.json());

	if (!payload.success) {
		return json(
			{
				error: payload.error.issues[0]?.message ?? 'Invalid test webhook payload.'
			},
			{ status: 400 }
		);
	}

	const result = await simulateTestWebhookInbound(payload.data);
	return json(result);
};
