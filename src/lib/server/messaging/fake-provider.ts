import { EventEmitter } from 'node:events';

import type {
	MessagingConnectionSnapshot,
	MessagingSendResult,
	NormalizedInboundMessage,
	NormalizedLocation
} from './types';
import { phoneFromJid } from './provider';

function nowIso() {
	return new Date().toISOString();
}

export class FakeMessagingProvider extends EventEmitter {
	constructor(private providerKey = 'fake-whatsapp') {
		super();
		this.connection.providerKey = providerKey;
	}

	private inboundHandler?: (message: NormalizedInboundMessage) => Promise<void>;
	private connection: MessagingConnectionSnapshot = {
		providerKey: 'fake-whatsapp',
		status: 'stopped',
		qrCode: null,
		lastReadyAt: null,
		lastDisconnectAt: null,
		lastSyncAt: null,
		lastError: null,
		updatedAt: nowIso()
	};

	public sent: Array<{
		toJid: string;
		kind: 'text' | 'location';
		body?: string;
		location?: NormalizedLocation;
	}> = [];

	async start(onInbound?: (message: NormalizedInboundMessage) => Promise<void>) {
		this.inboundHandler = onInbound;
		this.connection = {
			...this.connection,
			status: 'ready',
			lastReadyAt: nowIso(),
			lastSyncAt: nowIso(),
			updatedAt: nowIso()
		};
		this.emit('state', this.connection);
	}

	async stop() {
		this.connection = {
			...this.connection,
			status: 'stopped',
			updatedAt: nowIso()
		};
		this.emit('state', this.connection);
	}

	getConnectionState() {
		return this.connection;
	}

	getQrCode() {
		return null;
	}

	async sendText(toJid: string, body: string): Promise<MessagingSendResult> {
		this.sent.push({ toJid, kind: 'text', body });
		return { providerMessageId: `fake-${this.sent.length}` };
	}

	async sendLocation(toJid: string, location: NormalizedLocation): Promise<MessagingSendResult> {
		this.sent.push({ toJid, kind: 'location', location });
		return { providerMessageId: `fake-${this.sent.length}` };
	}

	normalizeInboundMessage(message: unknown): NormalizedInboundMessage {
		return message as NormalizedInboundMessage;
	}

	async emitInbound(
		message: Omit<NormalizedInboundMessage, 'providerKey' | 'fromPhone' | 'receivedAt'>
	) {
		const normalized: NormalizedInboundMessage = {
			...message,
			providerKey: this.connection.providerKey,
			fromPhone: phoneFromJid(message.fromJid),
			receivedAt: nowIso()
		};

		await this.inboundHandler?.(normalized);
	}
}
