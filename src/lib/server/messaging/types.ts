import type { ProviderConnectionStatus } from '$lib/server/db/schema';

export type NormalizedLocation = {
	latitude: number;
	longitude: number;
	name?: string;
	address?: string;
	url?: string;
};

export type NormalizedInboundMessage = {
	providerKey: string;
	externalMessageId: string;
	fromJid: string;
	fromPhone: string;
	type: 'text' | 'location' | 'unknown';
	text?: string;
	location?: NormalizedLocation;
	receivedAt: string;
	raw: unknown;
};

export type MessagingConnectionSnapshot = {
	providerKey: string;
	status: ProviderConnectionStatus;
	qrCode: string | null;
	lastReadyAt: string | null;
	lastDisconnectAt: string | null;
	lastSyncAt: string | null;
	lastError: string | null;
	updatedAt: string;
};

export type MessagingSendResult = {
	providerMessageId: string | null;
};

export type MessagingProvider = {
	start(onInbound?: (message: NormalizedInboundMessage) => Promise<void>): Promise<void>;
	stop(): Promise<void>;
	getConnectionState(): MessagingConnectionSnapshot;
	getQrCode(): string | null;
	sendText(toJid: string, body: string): Promise<MessagingSendResult>;
	sendLocation(toJid: string, location: NormalizedLocation): Promise<MessagingSendResult>;
	normalizeInboundMessage(message: unknown): NormalizedInboundMessage;
};
