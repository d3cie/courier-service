import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db/client';
import { packagePresetSeeds } from '$lib/server/db/catalog';
import {
	conversationSessions,
	orderLocations,
	orders,
	packageSizePresets,
	type ConversationState
} from '$lib/server/db/schema';
import {
	calculateVolumeCm3,
	fitsPreset,
	formatDimensions,
	parseDimensionsInput,
	parseWeightInput
} from '$lib/server/domain/capacity';
import type { NormalizedInboundMessage } from '$lib/server/messaging/types';
import type { OutboundMessenger } from '$lib/server/services/outbound-messenger';
import { OutboxOutboundMessenger } from '$lib/server/services/outbound-messenger';
import { logInboundMessage } from '$lib/server/services/outbox';

import { AssignmentEngine } from './assignment-engine';

function nowIso() {
	return new Date().toISOString();
}

function isText(
	message: NormalizedInboundMessage
): message is NormalizedInboundMessage & { type: 'text'; text: string } {
	return message.type === 'text' && typeof message.text === 'string';
}

function wantsSkip(text: string) {
	return ['skip', 'none', 'no', 'n/a'].includes(text.trim().toLowerCase());
}

function parseSizeChoice(input: string) {
	const normalized = input.trim().toLowerCase();
	const numericChoice = Number.parseInt(normalized, 10);

	if (Number.isFinite(numericChoice)) {
		return packagePresetSeeds.find((preset) => preset.sortOrder === numericChoice) ?? null;
	}

	return (
		packagePresetSeeds.find(
			(preset) => preset.key === normalized || preset.label.toLowerCase() === normalized
		) ?? null
	);
}

async function createDraftOrder(customerJid: string, customerPhone: string) {
	const inserted = await db
		.insert(orders)
		.values({
			customerJid,
			customerPhone,
			status: 'draft'
		})
		.returning({ id: orders.id });

	return inserted[0].id;
}

export class OrderIntakeService {
	constructor(
		private assignmentEngine: AssignmentEngine = new AssignmentEngine(),
		private outbound: OutboundMessenger = new OutboxOutboundMessenger()
	) {}

	private buildIntroMessage() {
		const choices = packagePresetSeeds
			.map(
				(preset) =>
					`${preset.sortOrder}. ${preset.label} (${preset.maxLengthCm}x${preset.maxWidthCm}x${preset.maxHeightCm} cm, up to ${preset.maxWeightKg} kg)`
			)
			.join('\n');

		return `Welcome to Courier Service.\nReply with the package size number below:\n${choices}`;
	}

	private async startNewSession(message: NormalizedInboundMessage) {
		const orderId = await createDraftOrder(message.fromJid, message.fromPhone);
		const [session] = await db
			.insert(conversationSessions)
			.values({
				customerJid: message.fromJid,
				customerPhone: message.fromPhone,
				orderId,
				state: 'awaiting_size',
				latestInboundAt: message.receivedAt,
				updatedAt: nowIso()
			})
			.onConflictDoUpdate({
				target: conversationSessions.customerJid,
				set: {
					customerPhone: message.fromPhone,
					orderId,
					state: 'awaiting_size',
					contextJson: '{}',
					latestInboundAt: message.receivedAt,
					updatedAt: nowIso()
				}
			})
			.returning();

		await this.outbound.queueText({
			toJid: message.fromJid,
			conversationSessionId: session.id,
			orderId,
			body: this.buildIntroMessage()
		});

		return session;
	}

	private async updateSession(sessionId: string, state: ConversationState, orderId: string) {
		await db
			.update(conversationSessions)
			.set({
				state,
				orderId,
				updatedAt: nowIso()
			})
			.where(eq(conversationSessions.id, sessionId));
	}

	private async upsertLocation(
		orderId: string,
		kind: 'pickup' | 'dropoff',
		message: NormalizedInboundMessage
	) {
		if (!message.location) {
			return;
		}

		await db
			.insert(orderLocations)
			.values({
				orderId,
				kind,
				latitude: message.location.latitude,
				longitude: message.location.longitude,
				name: message.location.name ?? null,
				address: message.location.address ?? null,
				url: message.location.url ?? null
			})
			.onConflictDoUpdate({
				target: [orderLocations.orderId, orderLocations.kind],
				set: {
					latitude: message.location.latitude,
					longitude: message.location.longitude,
					name: message.location.name ?? null,
					address: message.location.address ?? null,
					url: message.location.url ?? null,
					updatedAt: nowIso()
				}
			});
	}

	private async sendSummary(sessionId: string, orderId: string) {
		const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
		const [preset] = await db
			.select()
			.from(packageSizePresets)
			.where(eq(packageSizePresets.id, order?.packagePresetId ?? ''))
			.limit(1);
		const locations = await db
			.select()
			.from(orderLocations)
			.where(eq(orderLocations.orderId, orderId));
		const pickup = locations.find((entry) => entry.kind === 'pickup');
		const dropoff = locations.find((entry) => entry.kind === 'dropoff');

		if (!order || !preset || !pickup || !dropoff) {
			return;
		}

		await this.outbound.queueText({
			toJid: order.customerJid,
			conversationSessionId: sessionId,
			orderId,
			body:
				`Please confirm your request:\n` +
				`Size: ${preset.label}\n` +
				`Dimensions: ${formatDimensions({
					lengthCm: order.packageLengthCm ?? 0,
					widthCm: order.packageWidthCm ?? 0,
					heightCm: order.packageHeightCm ?? 0
				})}\n` +
				`Weight: ${order.packageWeightKg} kg\n` +
				`Pickup: ${pickup.latitude.toFixed(5)}, ${pickup.longitude.toFixed(5)}\n` +
				`Dropoff: ${dropoff.latitude.toFixed(5)}, ${dropoff.longitude.toFixed(5)}\n` +
				`Notes: ${order.notes || 'None'}\n` +
				`Reply 1 to confirm or 2 to cancel.`
		});
	}

	async handleInboundMessage(message: NormalizedInboundMessage) {
		let [session] = await db
			.select()
			.from(conversationSessions)
			.where(eq(conversationSessions.customerJid, message.fromJid))
			.limit(1);

		if (!session || ['completed', 'cancelled'].includes(session.state)) {
			session = await this.startNewSession(message);
			await logInboundMessage(message, {
				conversationSessionId: session.id,
				orderId: session.orderId
			});
			return;
		}

		await logInboundMessage(message, {
			conversationSessionId: session.id,
			orderId: session.orderId
		});

		if (!session.orderId) {
			session = await this.startNewSession(message);
			return;
		}

		await db
			.update(conversationSessions)
			.set({ latestInboundAt: message.receivedAt, updatedAt: nowIso() })
			.where(eq(conversationSessions.id, session.id));

		const [order] = await db.select().from(orders).where(eq(orders.id, session.orderId)).limit(1);

		if (!order) {
			await this.startNewSession(message);
			return;
		}

		switch (session.state) {
			case 'awaiting_size': {
				if (!isText(message)) {
					await this.outbound.queueText({
						toJid: message.fromJid,
						conversationSessionId: session.id,
						orderId: order.id,
						body: 'Reply with the package size number, for example 1 or 2.'
					});
					return;
				}

				const text = message.text;
				const choice = parseSizeChoice(text);

				if (!choice) {
					await this.outbound.queueText({
						toJid: message.fromJid,
						conversationSessionId: session.id,
						orderId: order.id,
						body: 'That size option was not recognised. Reply with 1, 2, 3, or 4.'
					});
					return;
				}

				const [preset] = await db
					.select()
					.from(packageSizePresets)
					.where(eq(packageSizePresets.key, choice.key))
					.limit(1);

				if (!preset) {
					return;
				}

				await db
					.update(orders)
					.set({
						packagePresetId: preset.id,
						updatedAt: nowIso()
					})
					.where(eq(orders.id, order.id));

				await this.updateSession(session.id, 'awaiting_dimensions', order.id);
				await this.outbound.queueText({
					toJid: message.fromJid,
					conversationSessionId: session.id,
					orderId: order.id,
					body: 'Send the exact package dimensions in centimeters as LxWxH, for example 40x30x20.'
				});
				return;
			}

			case 'awaiting_dimensions': {
				if (!isText(message)) {
					await this.outbound.queueText({
						toJid: message.fromJid,
						conversationSessionId: session.id,
						orderId: order.id,
						body: 'Send the exact dimensions as LxWxH in centimeters.'
					});
					return;
				}

				const text = message.text;
				const dimensions = parseDimensionsInput(text);

				if (!dimensions) {
					await this.outbound.queueText({
						toJid: message.fromJid,
						conversationSessionId: session.id,
						orderId: order.id,
						body: 'I could not read that. Example: 45x30x20'
					});
					return;
				}

				await db
					.update(orders)
					.set({
						packageLengthCm: dimensions.lengthCm,
						packageWidthCm: dimensions.widthCm,
						packageHeightCm: dimensions.heightCm,
						packageVolumeCm3: calculateVolumeCm3(
							dimensions.lengthCm,
							dimensions.widthCm,
							dimensions.heightCm
						),
						updatedAt: nowIso()
					})
					.where(eq(orders.id, order.id));

				await this.updateSession(session.id, 'awaiting_weight', order.id);
				await this.outbound.queueText({
					toJid: message.fromJid,
					conversationSessionId: session.id,
					orderId: order.id,
					body: 'Send the package weight in kilograms, for example 3.5'
				});
				return;
			}

			case 'awaiting_weight': {
				if (!isText(message)) {
					await this.outbound.queueText({
						toJid: message.fromJid,
						conversationSessionId: session.id,
						orderId: order.id,
						body: 'Send the package weight in kilograms.'
					});
					return;
				}

				const text = message.text;
				const weightKg = parseWeightInput(text);

				if (
					!weightKg ||
					!order.packageLengthCm ||
					!order.packageWidthCm ||
					!order.packageHeightCm
				) {
					await this.outbound.queueText({
						toJid: message.fromJid,
						conversationSessionId: session.id,
						orderId: order.id,
						body: 'That weight did not look valid. Send a number like 3 or 4.5.'
					});
					return;
				}

				const [preset] = await db
					.select()
					.from(packageSizePresets)
					.where(eq(packageSizePresets.id, order.packagePresetId ?? ''))
					.limit(1);

				if (!preset) {
					await this.updateSession(session.id, 'awaiting_size', order.id);
					await this.outbound.queueText({
						toJid: message.fromJid,
						conversationSessionId: session.id,
						orderId: order.id,
						body: this.buildIntroMessage()
					});
					return;
				}

				if (
					!fitsPreset(
						{
							lengthCm: order.packageLengthCm,
							widthCm: order.packageWidthCm,
							heightCm: order.packageHeightCm
						},
						weightKg,
						preset
					)
				) {
					await this.updateSession(session.id, 'awaiting_size', order.id);
					await this.outbound.queueText({
						toJid: message.fromJid,
						conversationSessionId: session.id,
						orderId: order.id,
						body: `Those dimensions or weight do not fit the selected size band (${preset.label}). Reply with a new size number to continue.`
					});
					return;
				}

				await db
					.update(orders)
					.set({
						packageWeightKg: weightKg,
						updatedAt: nowIso()
					})
					.where(eq(orders.id, order.id));

				await this.updateSession(session.id, 'awaiting_pickup_location', order.id);
				await this.outbound.queueText({
					toJid: message.fromJid,
					conversationSessionId: session.id,
					orderId: order.id,
					body: 'Please share the pickup location pin through WhatsApp.'
				});
				return;
			}

			case 'awaiting_pickup_location': {
				if (message.type !== 'location') {
					await this.outbound.queueText({
						toJid: message.fromJid,
						conversationSessionId: session.id,
						orderId: order.id,
						body: 'I need the pickup location pin. Use WhatsApp location sharing, not plain text.'
					});
					return;
				}

				await this.upsertLocation(order.id, 'pickup', message);
				await this.updateSession(session.id, 'awaiting_dropoff_location', order.id);
				await this.outbound.queueText({
					toJid: message.fromJid,
					conversationSessionId: session.id,
					orderId: order.id,
					body: 'Now share the dropoff location pin.'
				});
				return;
			}

			case 'awaiting_dropoff_location': {
				if (message.type !== 'location') {
					await this.outbound.queueText({
						toJid: message.fromJid,
						conversationSessionId: session.id,
						orderId: order.id,
						body: 'I need the dropoff location pin. Use WhatsApp location sharing.'
					});
					return;
				}

				await this.upsertLocation(order.id, 'dropoff', message);
				await this.updateSession(session.id, 'awaiting_notes', order.id);
				await this.outbound.queueText({
					toJid: message.fromJid,
					conversationSessionId: session.id,
					orderId: order.id,
					body: 'Add any delivery notes, or reply "skip" if there are none.'
				});
				return;
			}

			case 'awaiting_notes': {
				if (!isText(message)) {
					await this.outbound.queueText({
						toJid: message.fromJid,
						conversationSessionId: session.id,
						orderId: order.id,
						body: 'Reply with notes, or send "skip" to continue without notes.'
					});
					return;
				}

				const text = message.text;

				await db
					.update(orders)
					.set({
						status: 'awaiting_confirmation',
						notes: wantsSkip(text) ? null : text.trim(),
						updatedAt: nowIso()
					})
					.where(eq(orders.id, order.id));

				await this.updateSession(session.id, 'awaiting_confirmation', order.id);
				await this.sendSummary(session.id, order.id);
				return;
			}

			case 'awaiting_confirmation': {
				if (!isText(message)) {
					await this.outbound.queueText({
						toJid: message.fromJid,
						conversationSessionId: session.id,
						orderId: order.id,
						body: 'Reply 1 to confirm or 2 to cancel.'
					});
					return;
				}

				const text = message.text;
				const normalized = text.trim().toLowerCase();

				if (['2', 'cancel', 'no'].includes(normalized)) {
					await db
						.update(orders)
						.set({ status: 'cancelled', updatedAt: nowIso() })
						.where(eq(orders.id, order.id));
					await this.updateSession(session.id, 'cancelled', order.id);
					await this.outbound.queueText({
						toJid: message.fromJid,
						conversationSessionId: session.id,
						orderId: order.id,
						body: 'Your courier request has been cancelled. Send any message when you want to start a new one.'
					});
					return;
				}

				if (!['1', 'yes', 'confirm'].includes(normalized)) {
					await this.outbound.queueText({
						toJid: message.fromJid,
						conversationSessionId: session.id,
						orderId: order.id,
						body: 'Reply 1 to confirm or 2 to cancel.'
					});
					return;
				}

				await db
					.update(orders)
					.set({
						status: 'dispatching',
						customerConfirmedAt: nowIso(),
						updatedAt: nowIso()
					})
					.where(eq(orders.id, order.id));

				await this.updateSession(session.id, 'completed', order.id);

				await this.assignmentEngine.rankCandidates(order.id);
				const offer = await this.assignmentEngine.offerNextCandidate(order.id);

				await this.outbound.queueText({
					toJid: message.fromJid,
					conversationSessionId: session.id,
					orderId: order.id,
					body: offer
						? `Request confirmed. We are offering your job to the best available driver now. Your reference is ${order.id.slice(0, 8)}.`
						: `Request confirmed. We could not auto-assign a driver immediately, so dispatch will review order ${order.id.slice(0, 8)} manually.`
				});
				return;
			}

			default: {
				await this.outbound.queueText({
					toJid: message.fromJid,
					conversationSessionId: session.id,
					orderId: order.id,
					body: this.buildIntroMessage()
				});
			}
		}
	}
}
