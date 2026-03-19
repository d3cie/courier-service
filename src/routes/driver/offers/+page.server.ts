import { fail } from '@sveltejs/kit';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '$lib/server/db/client';
import { assignmentOffers, orderLocations, orders, vehicles } from '$lib/server/db/schema';
import { createCourierServices } from '$lib/server/services/container';
import { getDriverContextForUser } from '$lib/server/services/current-driver';

export const load = async ({ locals }) => {
	const { driver } = await getDriverContextForUser(locals.user!.id);
	const offers = await db
		.select({
			id: assignmentOffers.id,
			orderId: assignmentOffers.orderId,
			status: assignmentOffers.status,
			offeredAt: assignmentOffers.offeredAt,
			expiresAt: assignmentOffers.expiresAt,
			vehicleId: assignmentOffers.vehicleId,
			packageLengthCm: orders.packageLengthCm,
			packageWidthCm: orders.packageWidthCm,
			packageHeightCm: orders.packageHeightCm,
			packageWeightKg: orders.packageWeightKg,
			customerJid: orders.customerJid,
			vehicleName: vehicles.name
		})
		.from(assignmentOffers)
		.innerJoin(orders, eq(orders.id, assignmentOffers.orderId))
		.innerJoin(vehicles, eq(vehicles.id, assignmentOffers.vehicleId))
		.where(eq(assignmentOffers.driverId, driver.id))
		.orderBy(desc(assignmentOffers.offeredAt));

	const activeJobs = await db
		.select({
			id: orders.id,
			status: orders.status,
			customerJid: orders.customerJid,
			updatedAt: orders.updatedAt
		})
		.from(orders)
		.where(
			and(
				eq(orders.assignedDriverId, driver.id),
				inArray(orders.status, ['accepted', 'arriving_pickup', 'picked_up', 'in_transit'])
			)
		)
		.orderBy(desc(orders.updatedAt));

	const orderIds = [
		...new Set([...offers.map((offer) => offer.orderId), ...activeJobs.map((job) => job.id)])
	];
	const locations = orderIds.length
		? await db.select().from(orderLocations).where(inArray(orderLocations.orderId, orderIds))
		: [];
	const locationsByOrder = new Map<
		string,
		{ pickup?: (typeof locations)[number]; dropoff?: (typeof locations)[number] }
	>();

	for (const location of locations) {
		const current = locationsByOrder.get(location.orderId) ?? {};
		current[location.kind] = location;
		locationsByOrder.set(location.orderId, current);
	}

	return {
		driver,
		offers: offers.map((offer) => ({
			...offer,
			locations: locationsByOrder.get(offer.orderId) ?? {}
		})),
		activeJobs: activeJobs.map((job) => ({
			...job,
			locations: locationsByOrder.get(job.id) ?? {}
		}))
	};
};

export const actions = {
	accept: async ({ request, locals }) => {
		const { driver } = await getDriverContextForUser(locals.user!.id);
		const form = await request.formData();
		const offerId = String(form.get('offerId') ?? '');
		const { assignmentEngine } = createCourierServices();
		const accepted = await assignmentEngine.acceptOffer(offerId, driver.id);

		if (!accepted) {
			return fail(400, {
				error: 'This offer can no longer be accepted.'
			});
		}

		return { success: true };
	},

	reject: async ({ request, locals }) => {
		const { driver } = await getDriverContextForUser(locals.user!.id);
		const form = await request.formData();
		const offerId = String(form.get('offerId') ?? '');
		const { assignmentEngine } = createCourierServices();
		const rejected = await assignmentEngine.rejectOffer(offerId, driver.id);

		if (!rejected) {
			return fail(400, {
				error: 'This offer can no longer be declined.'
			});
		}

		return { success: true };
	}
};
