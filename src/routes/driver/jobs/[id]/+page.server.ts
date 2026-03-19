import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';

import { db } from '$lib/server/db/client';
import { orderLocations, orders, vehicles } from '$lib/server/db/schema';
import { createCourierServices } from '$lib/server/services/container';
import { getDriverContextForUser } from '$lib/server/services/current-driver';

const progressableStatuses = ['accepted', 'arriving_pickup', 'picked_up', 'in_transit'];

export const load = async ({ params, locals }) => {
	const { driver } = await getDriverContextForUser(locals.user!.id);
	const [order] = await db
		.select({
			id: orders.id,
			status: orders.status,
			customerJid: orders.customerJid,
			notes: orders.notes,
			packageLengthCm: orders.packageLengthCm,
			packageWidthCm: orders.packageWidthCm,
			packageHeightCm: orders.packageHeightCm,
			packageWeightKg: orders.packageWeightKg,
			vehicleName: vehicles.name
		})
		.from(orders)
		.leftJoin(vehicles, eq(vehicles.id, orders.assignedVehicleId))
		.where(and(eq(orders.id, params.id), eq(orders.assignedDriverId, driver.id)))
		.limit(1);

	if (!order) {
		throw error(404, 'Job not found.');
	}

	const locations = await db
		.select()
		.from(orderLocations)
		.where(eq(orderLocations.orderId, order.id));

	return {
		order,
		locations: {
			pickup: locations.find((entry) => entry.kind === 'pickup') ?? null,
			dropoff: locations.find((entry) => entry.kind === 'dropoff') ?? null
		},
		canAdvance: progressableStatuses.includes(order.status)
	};
};

export const actions = {
	progress: async ({ request, locals }) => {
		const { driver } = await getDriverContextForUser(locals.user!.id);
		const form = await request.formData();
		const orderId = String(form.get('orderId') ?? '');
		const { assignmentEngine } = createCourierServices();
		const advanced = await assignmentEngine.advanceOrderStatus(orderId, driver.id);

		if (!advanced) {
			return fail(400, {
				error: 'This job cannot move to the next stage.'
			});
		}

		return { success: true };
	}
};
