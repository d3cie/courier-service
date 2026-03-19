import type { EventedMessagingProvider } from '$lib/server/messaging/provider';

import {
	loadDueOutboxMessages,
	logOutboundMessage,
	markOutboxFailed,
	markOutboxProcessing,
	markOutboxSent
} from './outbox';

export async function dispatchDueOutboxMessages(
	provider: EventedMessagingProvider,
	options: { channel?: string; limit?: number } = {}
) {
	if (provider.getConnectionState().status !== 'ready') {
		return [];
	}

	const dueMessages = await loadDueOutboxMessages(options);
	const dispatched: typeof dueMessages = [];

	for (const message of dueMessages) {
		try {
			await markOutboxProcessing(message.id);

			const result =
				message.kind === 'location'
					? await provider.sendLocation(message.toJid, {
							latitude: message.locationLatitude ?? 0,
							longitude: message.locationLongitude ?? 0,
							name: message.locationName ?? undefined,
							address: message.body ?? undefined
						})
					: await provider.sendText(message.toJid, message.body ?? '');

			await markOutboxSent(message.id);
			await logOutboundMessage({
				provider: provider.getConnectionState().providerKey,
				externalMessageId: result.providerMessageId,
				conversationSessionId: message.conversationSessionId,
				orderId: message.orderId,
				customerJid: message.toJid,
				messageType: message.kind === 'location' ? 'location' : 'text',
				body: message.body,
				payloadJson:
					message.kind === 'location'
						? JSON.stringify({
								latitude: message.locationLatitude,
								longitude: message.locationLongitude,
								name: message.locationName
							})
						: null
			});
			dispatched.push(message);
		} catch (error) {
			await markOutboxFailed(
				message.id,
				message.attempts,
				error instanceof Error ? error.message : 'Unknown outbox error'
			);
		}
	}

	return dispatched;
}
