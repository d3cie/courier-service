import { createCourierServices } from '$lib/server/services/container';
import { dispatchDueOutboxMessages } from '$lib/server/services/message-dispatch';
import { updateIntegrationState } from '$lib/server/services/outbox';
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
			await dispatchDueOutboxMessages(provider, { channel: 'whatsapp', limit: 20 });
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
