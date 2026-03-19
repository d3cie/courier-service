import { EventEmitter } from 'node:events';
import path from 'node:path';

import QRCode from 'qrcode';
import * as whatsappWeb from 'whatsapp-web.js';
import type { Message } from 'whatsapp-web.js';

import type {
	MessagingConnectionSnapshot,
	MessagingSendResult,
	NormalizedInboundMessage,
	NormalizedLocation
} from './types';
import { phoneFromJid } from './provider';

const whatsappRuntime = (
	'default' in whatsappWeb ? whatsappWeb.default : whatsappWeb
) as typeof import('whatsapp-web.js');
const { Client, LocalAuth, Location } = whatsappRuntime;

function nowIso() {
	return new Date().toISOString();
}

function defaultPuppeteerArgs() {
	return ['--no-sandbox', '--disable-setuid-sandbox'];
}

function resolveHeadlessMode() {
	const value = process.env.PUPPETEER_HEADLESS?.trim().toLowerCase();

	if (!value || value === 'true') {
		return true;
	}

	if (value === 'false') {
		return false;
	}

	if (value === 'shell') {
		return 'shell';
	}

	return true;
}

function startupTimeoutMs() {
	return Number(process.env.WHATSAPP_STARTUP_TIMEOUT_MS ?? '60000');
}

export class WhatsappWebMessagingProvider extends EventEmitter {
	private client: InstanceType<typeof Client> | null = null;
	private inboundHandler?: (message: NormalizedInboundMessage) => Promise<void>;
	private connection: MessagingConnectionSnapshot = {
		providerKey: 'whatsapp-web',
		status: 'stopped',
		qrCode: null,
		lastReadyAt: null,
		lastDisconnectAt: null,
		lastSyncAt: null,
		lastError: null,
		updatedAt: nowIso()
	};

	private updateConnection(
		partial: Partial<Omit<MessagingConnectionSnapshot, 'providerKey' | 'updatedAt'>>
	) {
		this.connection = {
			...this.connection,
			...partial,
			updatedAt: nowIso()
		};

		this.emit('state', this.connection);
	}

	async start(onInbound?: (message: NormalizedInboundMessage) => Promise<void>) {
		if (this.client) {
			return;
		}

		this.inboundHandler = onInbound;
		this.updateConnection({
			status: 'starting',
			lastError: null,
			lastSyncAt: nowIso()
		});

		const authPath = path.resolve(
			process.cwd(),
			process.env.WHATSAPP_AUTH_PATH ?? path.join('data', '.wwebjs_auth')
		);
		const puppeteerArgs = process.env.PUPPETEER_ARGS
			? process.env.PUPPETEER_ARGS.split(',').map((value) => value.trim())
			: defaultPuppeteerArgs();
		const headless = resolveHeadlessMode();

		this.client = new Client({
			authStrategy: new LocalAuth({
				dataPath: authPath,
				clientId: process.env.WHATSAPP_CLIENT_ID ?? 'courier-primary'
			}),
			takeoverOnConflict: true,
			takeoverTimeoutMs: 0,
			webVersionCache: {
				type: 'none'
			},
			puppeteer: {
				headless,
				args: puppeteerArgs
			}
		});

		const startupTimeout = setTimeout(() => {
			this.updateConnection({
				status: 'error',
				lastError:
					'WhatsApp startup timed out before QR/auth/ready. Try `PUPPETEER_HEADLESS=false pnpm worker` and check the worker terminal.',
				lastSyncAt: nowIso()
			});
		}, startupTimeoutMs());

		const markProgress = (statusMessage: string) => {
			clearTimeout(startupTimeout);
			this.updateConnection({
				lastError: statusMessage,
				lastSyncAt: nowIso()
			});
		};

		this.client.on('loading_screen', (percent, message) => {
			markProgress(`WhatsApp loading ${percent}% (${message}).`);
		});

		this.client.on('qr', async (qr) => {
			clearTimeout(startupTimeout);
			const qrCode = await QRCode.toDataURL(qr);
			this.updateConnection({
				status: 'qr_ready',
				qrCode,
				lastSyncAt: nowIso()
			});
		});

		this.client.on('authenticated', () => {
			markProgress('WhatsApp authenticated. Waiting for ready state.');
		});

		this.client.on('change_state', (state) => {
			markProgress(`WhatsApp state changed to ${state}.`);
		});

		this.client.on('ready', () => {
			clearTimeout(startupTimeout);
			this.updateConnection({
				status: 'ready',
				qrCode: null,
				lastReadyAt: nowIso(),
				lastSyncAt: nowIso(),
				lastError: null
			});
		});

		this.client.on('auth_failure', (reason) => {
			clearTimeout(startupTimeout);
			this.updateConnection({
				status: 'error',
				lastError: String(reason),
				lastSyncAt: nowIso()
			});
		});

		this.client.on('disconnected', (reason) => {
			clearTimeout(startupTimeout);
			this.updateConnection({
				status: 'disconnected',
				lastDisconnectAt: nowIso(),
				lastError: String(reason),
				lastSyncAt: nowIso()
			});
		});

		this.client.on('message', async (message) => {
			if (message.fromMe) {
				return;
			}

			const normalized = this.normalizeInboundMessage(message);
			await this.inboundHandler?.(normalized);
		});

		try {
			await this.client.initialize();
		} catch (error) {
			clearTimeout(startupTimeout);
			this.updateConnection({
				status: 'error',
				lastError: error instanceof Error ? error.message : String(error),
				lastSyncAt: nowIso()
			});
			throw error;
		}
	}

	async stop() {
		if (this.client) {
			await this.client.destroy();
			this.client = null;
		}

		this.updateConnection({
			status: 'stopped',
			lastSyncAt: nowIso()
		});
	}

	getConnectionState() {
		return this.connection;
	}

	getQrCode() {
		return this.connection.qrCode;
	}

	async sendText(toJid: string, body: string): Promise<MessagingSendResult> {
		if (!this.client) {
			throw new Error('WhatsApp client is not started.');
		}

		const sent = await this.client.sendMessage(toJid, body);
		return {
			providerMessageId: sent.id?._serialized ?? null
		};
	}

	async sendLocation(toJid: string, location: NormalizedLocation): Promise<MessagingSendResult> {
		if (!this.client) {
			throw new Error('WhatsApp client is not started.');
		}

		const sent = await this.client.sendMessage(
			toJid,
			new Location(location.latitude, location.longitude, {
				name: location.name,
				address: location.address,
				url: location.url
			})
		);

		return {
			providerMessageId: sent.id?._serialized ?? null
		};
	}

	normalizeInboundMessage(message: Message): NormalizedInboundMessage {
		const type = message.location ? 'location' : message.body ? 'text' : 'unknown';

		return {
			providerKey: this.connection.providerKey,
			externalMessageId: message.id._serialized ?? message.id.id,
			fromJid: message.from,
			fromPhone: phoneFromJid(message.from),
			type,
			text: message.body || undefined,
			location: message.location
				? {
						latitude: Number(message.location.latitude),
						longitude: Number(message.location.longitude),
						name: message.location.name,
						address: message.location.address,
						url: message.location.url
					}
				: undefined,
			receivedAt: nowIso(),
			raw: {
				body: message.body,
				from: message.from,
				location: message.location
			}
		};
	}
}
