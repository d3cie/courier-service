import { describe, expect, it } from 'vitest';

import { shouldHandleWhatsappInboundMessage } from './whatsapp-web-provider';

function createInboundEvent(
	overrides: Partial<{
		body: string;
		broadcast: boolean;
		from: string;
		fromMe: boolean;
		isStatus: boolean;
		location: { latitude: number; longitude: number };
		type: 'chat' | 'location';
	}> = {}
) {
	return {
		body: overrides.body ?? 'hello',
		broadcast: overrides.broadcast ?? false,
		from: overrides.from ?? '263700123456@c.us',
		fromMe: overrides.fromMe ?? false,
		id: {
			id: 'message-id',
			_serialized: 'message-id'
		},
		isStatus: overrides.isStatus ?? false,
		location: overrides.location,
		type: overrides.type ?? 'chat'
	};
}

describe('shouldHandleWhatsappInboundMessage', () => {
	it('accepts direct one-to-one chat messages', () => {
		expect(shouldHandleWhatsappInboundMessage(createInboundEvent())).toBe(true);
	});

	it('accepts direct one-to-one location messages', () => {
		expect(
			shouldHandleWhatsappInboundMessage(
				createInboundEvent({
					body: '',
					location: { latitude: -17.829, longitude: 31.052 },
					type: 'location'
				})
			)
		).toBe(true);
	});

	it('rejects status broadcasts before they reach the intake flow', () => {
		expect(
			shouldHandleWhatsappInboundMessage(
				createInboundEvent({
					from: 'status@broadcast',
					isStatus: true
				})
			)
		).toBe(false);
	});

	it('rejects groups, newsletters, and general broadcasts', () => {
		expect(
			shouldHandleWhatsappInboundMessage(
				createInboundEvent({
					from: '120363123456789012@g.us'
				})
			)
		).toBe(false);
		expect(
			shouldHandleWhatsappInboundMessage(
				createInboundEvent({
					from: '123456789@newsletter'
				})
			)
		).toBe(false);
		expect(
			shouldHandleWhatsappInboundMessage(
				createInboundEvent({
					broadcast: true
				})
			)
		).toBe(false);
	});
});
