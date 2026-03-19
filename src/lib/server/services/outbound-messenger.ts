import type { NormalizedLocation } from '$lib/server/messaging/types';

import { queueLocationMessage, queueTextMessage } from './outbox';

export type QueueTextMessageInput = {
	toJid: string;
	body: string;
	orderId?: string | null;
	conversationSessionId?: string | null;
	dedupeKey?: string | null;
};

export type QueueLocationMessageInput = {
	toJid: string;
	location: NormalizedLocation;
	orderId?: string | null;
	conversationSessionId?: string | null;
	dedupeKey?: string | null;
};

export type OutboundMessenger = {
	queueText(options: QueueTextMessageInput): Promise<void>;
	queueLocation(options: QueueLocationMessageInput): Promise<void>;
};

export class OutboxOutboundMessenger implements OutboundMessenger {
	constructor(private channel = 'whatsapp') {}

	private buildDedupeKey(dedupeKey?: string | null) {
		if (!dedupeKey) {
			return null;
		}

		return this.channel === 'whatsapp' ? dedupeKey : `${this.channel}:${dedupeKey}`;
	}

	queueText(options: QueueTextMessageInput) {
		return queueTextMessage({
			...options,
			channel: this.channel,
			dedupeKey: this.buildDedupeKey(options.dedupeKey)
		});
	}

	queueLocation(options: QueueLocationMessageInput) {
		return queueLocationMessage({
			...options,
			channel: this.channel,
			dedupeKey: this.buildDedupeKey(options.dedupeKey)
		});
	}
}
