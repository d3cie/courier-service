import { createCourierServices } from '$lib/server/services/container';
import {
	loadDueOutboxMessages,
	logOutboundMessage,
	markOutboxFailed,
	markOutboxProcessing,
	markOutboxSent,
	updateIntegrationState
} from '$lib/server/services/outbox';
import { ensureDatabaseReady } from '$lib/server/db/bootstrap';
import type { EventedMessagingProvider } from '$lib/server/messaging/provider';
import { WhatsappWebMessagingProvider } from '$lib/server/messaging/whatsapp-web-provider';

function intervalMs() {
	return Number(process.env.WHATSAPP_POLL_INTERVAL_MS ?? '5000');
}

export async function startCourierWorker(
	provider: EventedMessagingProvider = new WhatsappWebMessagingProvider()
) {
	await ensureDatabaseReady();

	const services = createCourierServices();
	let outboxBusy = false;
	let expiryBusy = false;

	const syncState = async () => {
		await updateIntegrationState(provider.getConnectionState());
	};

	provider.on('state', (snapshot) => {
		void updateIntegrationState(snapshot);
	});

	const processOutbox = async () => {
		if (outboxBusy || provider.getConnectionState().status !== 'ready') {
			return;
		}

		outboxBusy = true;

		try {
			const dueMessages = await loadDueOutboxMessages(20);

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
				} catch (error) {
					await markOutboxFailed(
						message.id,
						message.attempts,
						error instanceof Error ? error.message : 'Unknown outbox error'
					);
				}
			}
		} finally {
			outboxBusy = false;
		}
	};

	const processOfferExpiries = async () => {
		if (expiryBusy) {
			return;
		}

		expiryBusy = true;

		try {
			await services.assignmentEngine.expirePendingOffers();
		} finally {
			expiryBusy = false;
		}
	};

	await provider.start(async (message) => {
		await services.orderIntakeService.handleInboundMessage(message);
	});

	await syncState();

	const outboxTimer = setInterval(() => void processOutbox(), intervalMs());
	const expiryTimer = setInterval(() => void processOfferExpiries(), intervalMs());

	const shutdown = async () => {
		clearInterval(outboxTimer);
		clearInterval(expiryTimer);
		await provider.stop();
		await syncState();
		process.exit(0);
	};

	process.on('SIGINT', () => void shutdown());
	process.on('SIGTERM', () => void shutdown());
}
