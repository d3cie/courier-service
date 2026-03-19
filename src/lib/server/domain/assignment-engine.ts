import { and, asc, eq, inArray, isNotNull, lte, ne } from 'drizzle-orm';

import { db } from '$lib/server/db/client';
import {
	assignmentCandidates,
	assignmentOffers,
	driverAvailability,
	drivers,
	orderLocations,
	orders,
	vehicles
} from '$lib/server/db/schema';
import { buildVehicleCapacity, fitsVehicle } from '$lib/server/domain/capacity';
import { haversineDistanceMeters } from '$lib/server/domain/geo';
import { queueTextMessage } from '$lib/server/services/outbox';

function nowIso() {
	return new Date().toISOString();
}

function offerExpiryIso() {
	const seconds = Number(process.env.WHATSAPP_OFFER_TIMEOUT_SECONDS ?? '120');
	return new Date(Date.now() + seconds * 1000).toISOString();
}

async function getDispatchContext(orderId: string) {
	const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
	const locations = await db
		.select()
		.from(orderLocations)
		.where(eq(orderLocations.orderId, orderId));
	const pickup = locations.find((entry) => entry.kind === 'pickup');

	return { order, pickup };
}

export class AssignmentEngine {
	async rankCandidates(orderId: string) {
		const { order, pickup } = await getDispatchContext(orderId);

		if (
			!order ||
			!pickup ||
			!order.packageLengthCm ||
			!order.packageWidthCm ||
			!order.packageHeightCm ||
			!order.packageWeightKg ||
			!order.packageVolumeCm3
		) {
			return [];
		}

		const rows = await db
			.select({
				driverId: drivers.id,
				driverName: drivers.displayName,
				driverWhatsappJid: drivers.whatsappJid,
				availabilityId: driverAvailability.id,
				lastStatusAt: driverAvailability.lastStatusAt,
				currentLatitude: driverAvailability.currentLatitude,
				currentLongitude: driverAvailability.currentLongitude,
				vehicleId: vehicles.id,
				vehicleName: vehicles.name,
				templateKey: vehicles.templateKey,
				capacityTier: vehicles.capacityTier,
				maxLengthCm: vehicles.maxLengthCm,
				maxWidthCm: vehicles.maxWidthCm,
				maxHeightCm: vehicles.maxHeightCm,
				maxWeightKg: vehicles.maxWeightKg,
				maxVolumeCm3: vehicles.maxVolumeCm3
			})
			.from(driverAvailability)
			.innerJoin(drivers, eq(drivers.id, driverAvailability.driverId))
			.innerJoin(vehicles, eq(vehicles.id, driverAvailability.activeVehicleId))
			.where(
				and(
					eq(driverAvailability.isOnline, true),
					eq(driverAvailability.availabilityStatus, 'idle'),
					eq(drivers.status, 'active'),
					isNotNull(driverAvailability.currentLatitude),
					isNotNull(driverAvailability.currentLongitude)
				)
			);

		const packageShape = {
			lengthCm: order.packageLengthCm,
			widthCm: order.packageWidthCm,
			heightCm: order.packageHeightCm,
			weightKg: order.packageWeightKg,
			volumeCm3: order.packageVolumeCm3
		};

		const ranked = rows
			.filter((row) =>
				fitsVehicle(
					packageShape,
					buildVehicleCapacity({
						maxLengthCm: row.maxLengthCm,
						maxWidthCm: row.maxWidthCm,
						maxHeightCm: row.maxHeightCm,
						maxWeightKg: row.maxWeightKg,
						capacityTier: row.capacityTier
					})
				)
			)
			.map((row) => {
				const idleSeconds = Math.max(
					0,
					Math.round((Date.now() - new Date(row.lastStatusAt).getTime()) / 1000)
				);
				const distanceMeters = haversineDistanceMeters(
					{
						latitude: row.currentLatitude as number,
						longitude: row.currentLongitude as number
					},
					{
						latitude: pickup.latitude,
						longitude: pickup.longitude
					}
				);
				const capacityWasteCm3 = row.maxVolumeCm3 - packageShape.volumeCm3;

				return {
					driverId: row.driverId,
					driverName: row.driverName,
					driverWhatsappJid: row.driverWhatsappJid,
					vehicleId: row.vehicleId,
					vehicleName: row.vehicleName,
					templateKey: row.templateKey,
					capacityTier: row.capacityTier,
					distanceMeters,
					idleSeconds,
					capacityWasteCm3
				};
			})
			.sort((left, right) => {
				return (
					left.capacityTier - right.capacityTier ||
					left.capacityWasteCm3 - right.capacityWasteCm3 ||
					left.distanceMeters - right.distanceMeters ||
					right.idleSeconds - left.idleSeconds
				);
			});

		await db.delete(assignmentOffers).where(eq(assignmentOffers.orderId, orderId));
		await db.delete(assignmentCandidates).where(eq(assignmentCandidates.orderId, orderId));

		if (ranked.length === 0) {
			return [];
		}

		const inserted = await db
			.insert(assignmentCandidates)
			.values(
				ranked.map((candidate, index) => ({
					orderId,
					driverId: candidate.driverId,
					vehicleId: candidate.vehicleId,
					rank: index + 1,
					capacityTier: candidate.capacityTier,
					capacityWasteCm3: candidate.capacityWasteCm3,
					distanceMeters: candidate.distanceMeters,
					idleSeconds: candidate.idleSeconds,
					status: 'pending' as const
				}))
			)
			.returning();

		await db
			.update(orders)
			.set({
				status: 'dispatching',
				updatedAt: nowIso()
			})
			.where(eq(orders.id, orderId));

		return inserted;
	}

	async markManualReview(orderId: string) {
		const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

		if (!order) {
			return;
		}

		await db
			.update(orders)
			.set({
				status: 'manual_review',
				updatedAt: nowIso()
			})
			.where(eq(orders.id, orderId));

		await queueTextMessage({
			toJid: order.customerJid,
			orderId,
			body: `We could not auto-assign a driver yet. Dispatch has been notified and will review order ${orderId.slice(0, 8)} manually.`,
			dedupeKey: `manual-review:${orderId}`
		});
	}

	async offerNextCandidate(orderId: string) {
		const [pendingOffer] = await db
			.select()
			.from(assignmentOffers)
			.where(and(eq(assignmentOffers.orderId, orderId), eq(assignmentOffers.status, 'pending')))
			.limit(1);

		if (pendingOffer) {
			return pendingOffer;
		}

		const [candidate] = await db
			.select({
				id: assignmentCandidates.id,
				orderId: assignmentCandidates.orderId,
				driverId: assignmentCandidates.driverId,
				vehicleId: assignmentCandidates.vehicleId,
				rank: assignmentCandidates.rank,
				driverName: drivers.displayName,
				driverWhatsappJid: drivers.whatsappJid,
				vehicleName: vehicles.name
			})
			.from(assignmentCandidates)
			.innerJoin(drivers, eq(drivers.id, assignmentCandidates.driverId))
			.innerJoin(vehicles, eq(vehicles.id, assignmentCandidates.vehicleId))
			.where(
				and(eq(assignmentCandidates.orderId, orderId), eq(assignmentCandidates.status, 'pending'))
			)
			.orderBy(asc(assignmentCandidates.rank))
			.limit(1);

		if (!candidate) {
			await this.markManualReview(orderId);
			return null;
		}

		const offeredAt = nowIso();
		const expiresAt = offerExpiryIso();
		const [offer] = await db
			.insert(assignmentOffers)
			.values({
				orderId,
				assignmentCandidateId: candidate.id,
				driverId: candidate.driverId,
				vehicleId: candidate.vehicleId,
				status: 'pending',
				offeredAt,
				expiresAt
			})
			.returning();

		await db
			.update(assignmentCandidates)
			.set({ status: 'offered', updatedAt: nowIso() })
			.where(eq(assignmentCandidates.id, candidate.id));

		await db
			.update(driverAvailability)
			.set({ availabilityStatus: 'offered', lastStatusAt: nowIso(), updatedAt: nowIso() })
			.where(eq(driverAvailability.driverId, candidate.driverId));

		await db
			.update(orders)
			.set({ status: 'offered', updatedAt: nowIso() })
			.where(eq(orders.id, orderId));

		if (candidate.driverWhatsappJid) {
			await queueTextMessage({
				toJid: candidate.driverWhatsappJid,
				orderId,
				body: `New courier offer: order ${orderId.slice(0, 8)} is available for ${candidate.driverName} using ${candidate.vehicleName}. Please open the driver portal to accept or decline before ${new Date(expiresAt).toLocaleTimeString()}.`,
				dedupeKey: `driver-offer:${offer.id}`
			});
		}

		return offer;
	}

	async acceptOffer(offerId: string, driverId: string) {
		const [offer] = await db
			.select()
			.from(assignmentOffers)
			.where(
				and(
					eq(assignmentOffers.id, offerId),
					eq(assignmentOffers.driverId, driverId),
					eq(assignmentOffers.status, 'pending')
				)
			)
			.limit(1);

		if (!offer || offer.expiresAt < nowIso()) {
			return false;
		}

		const [driver] = await db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
		const [vehicle] = await db
			.select()
			.from(vehicles)
			.where(eq(vehicles.id, offer.vehicleId))
			.limit(1);
		const [order] = await db.select().from(orders).where(eq(orders.id, offer.orderId)).limit(1);

		if (!driver || !vehicle || !order) {
			return false;
		}

		await db
			.update(assignmentOffers)
			.set({ status: 'accepted', respondedAt: nowIso(), updatedAt: nowIso() })
			.where(eq(assignmentOffers.id, offerId));

		await db
			.update(assignmentCandidates)
			.set({ status: 'accepted', updatedAt: nowIso() })
			.where(eq(assignmentCandidates.id, offer.assignmentCandidateId));

		const remainingCandidates = await db
			.select({ id: assignmentCandidates.id })
			.from(assignmentCandidates)
			.where(
				and(
					eq(assignmentCandidates.orderId, order.id),
					ne(assignmentCandidates.id, offer.assignmentCandidateId)
				)
			);

		if (remainingCandidates.length > 0) {
			await db
				.update(assignmentCandidates)
				.set({ status: 'skipped', updatedAt: nowIso() })
				.where(
					inArray(
						assignmentCandidates.id,
						remainingCandidates.map((candidate) => candidate.id)
					)
				);
		}

		await db
			.update(assignmentOffers)
			.set({ status: 'expired', respondedAt: nowIso(), updatedAt: nowIso() })
			.where(and(eq(assignmentOffers.orderId, order.id), ne(assignmentOffers.id, offerId)));

		await db
			.update(orders)
			.set({
				status: 'accepted',
				assignedDriverId: driverId,
				assignedVehicleId: offer.vehicleId,
				dispatchStartedAt: nowIso(),
				updatedAt: nowIso()
			})
			.where(eq(orders.id, order.id));

		await db
			.update(driverAvailability)
			.set({
				availabilityStatus: 'assigned',
				lastStatusAt: nowIso(),
				updatedAt: nowIso()
			})
			.where(eq(driverAvailability.driverId, driverId));

		await queueTextMessage({
			toJid: order.customerJid,
			orderId: order.id,
			body: `Driver ${driver.displayName} accepted your courier request and is preparing with ${vehicle.name}.`,
			dedupeKey: `offer-accepted:${offerId}`
		});

		return true;
	}

	async rejectOffer(offerId: string, driverId: string) {
		const [offer] = await db
			.select()
			.from(assignmentOffers)
			.where(
				and(
					eq(assignmentOffers.id, offerId),
					eq(assignmentOffers.driverId, driverId),
					eq(assignmentOffers.status, 'pending')
				)
			)
			.limit(1);

		if (!offer) {
			return false;
		}

		await db
			.update(assignmentOffers)
			.set({ status: 'rejected', respondedAt: nowIso(), updatedAt: nowIso() })
			.where(eq(assignmentOffers.id, offerId));

		await db
			.update(assignmentCandidates)
			.set({ status: 'rejected', updatedAt: nowIso() })
			.where(eq(assignmentCandidates.id, offer.assignmentCandidateId));

		await db
			.update(driverAvailability)
			.set({ availabilityStatus: 'idle', lastStatusAt: nowIso(), updatedAt: nowIso() })
			.where(eq(driverAvailability.driverId, driverId));

		await db
			.update(orders)
			.set({ status: 'dispatching', updatedAt: nowIso() })
			.where(eq(orders.id, offer.orderId));

		await this.offerNextCandidate(offer.orderId);
		return true;
	}

	async expirePendingOffers() {
		const expired = await db
			.select()
			.from(assignmentOffers)
			.where(
				and(eq(assignmentOffers.status, 'pending'), lte(assignmentOffers.expiresAt, nowIso()))
			);

		for (const offer of expired) {
			await this.expireOffer(offer.id);
		}

		return expired.length;
	}

	async expireOffer(offerId: string) {
		const [offer] = await db
			.select()
			.from(assignmentOffers)
			.where(and(eq(assignmentOffers.id, offerId), eq(assignmentOffers.status, 'pending')))
			.limit(1);

		if (!offer) {
			return false;
		}

		await db
			.update(assignmentOffers)
			.set({ status: 'expired', respondedAt: nowIso(), updatedAt: nowIso() })
			.where(eq(assignmentOffers.id, offerId));

		await db
			.update(assignmentCandidates)
			.set({ status: 'expired', updatedAt: nowIso() })
			.where(eq(assignmentCandidates.id, offer.assignmentCandidateId));

		await db
			.update(driverAvailability)
			.set({ availabilityStatus: 'idle', lastStatusAt: nowIso(), updatedAt: nowIso() })
			.where(eq(driverAvailability.driverId, offer.driverId));

		await db
			.update(orders)
			.set({ status: 'dispatching', updatedAt: nowIso() })
			.where(eq(orders.id, offer.orderId));

		await this.offerNextCandidate(offer.orderId);
		return true;
	}

	async advanceOrderStatus(orderId: string, driverId: string) {
		const [order] = await db
			.select()
			.from(orders)
			.where(and(eq(orders.id, orderId), eq(orders.assignedDriverId, driverId)))
			.limit(1);

		if (!order) {
			return false;
		}

		const nextStatusMap = {
			accepted: 'arriving_pickup',
			arriving_pickup: 'picked_up',
			picked_up: 'in_transit',
			in_transit: 'delivered'
		} as const;

		const nextStatus = nextStatusMap[order.status as keyof typeof nextStatusMap];

		if (!nextStatus) {
			return false;
		}

		await db
			.update(orders)
			.set({
				status: nextStatus,
				deliveredAt: nextStatus === 'delivered' ? nowIso() : order.deliveredAt,
				updatedAt: nowIso()
			})
			.where(eq(orders.id, orderId));

		if (nextStatus === 'delivered') {
			const [availability] = await db
				.select()
				.from(driverAvailability)
				.where(eq(driverAvailability.driverId, driverId))
				.limit(1);

			await db
				.update(driverAvailability)
				.set({
					availabilityStatus: availability?.isOnline ? 'idle' : 'offline',
					lastStatusAt: nowIso(),
					updatedAt: nowIso()
				})
				.where(eq(driverAvailability.driverId, driverId));
		}

		const customerMessages = {
			arriving_pickup: 'Your driver is heading to the pickup point now.',
			picked_up: 'Your package has been picked up.',
			in_transit: 'Your package is now in transit.',
			delivered: 'Your package has been marked as delivered.'
		} as const;

		await queueTextMessage({
			toJid: order.customerJid,
			orderId,
			body: customerMessages[nextStatus],
			dedupeKey: `order-status:${orderId}:${nextStatus}`
		});

		return true;
	}
}
