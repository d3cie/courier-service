import { desc, eq } from 'drizzle-orm';

import { db } from '$lib/server/db/client';
import {
	drivers,
	orderLocations,
	orders,
	packageSizePresets,
	vehicles
} from '$lib/server/db/schema';

export const load = async () => {
	const orderRows = await db
		.select({
			id: orders.id,
			status: orders.status,
			customerJid: orders.customerJid,
			packageLengthCm: orders.packageLengthCm,
			packageWidthCm: orders.packageWidthCm,
			packageHeightCm: orders.packageHeightCm,
			packageWeightKg: orders.packageWeightKg,
			notes: orders.notes,
			createdAt: orders.createdAt,
			presetLabel: packageSizePresets.label,
			driverName: drivers.displayName,
			vehicleName: vehicles.name
		})
		.from(orders)
		.leftJoin(packageSizePresets, eq(packageSizePresets.id, orders.packagePresetId))
		.leftJoin(drivers, eq(drivers.id, orders.assignedDriverId))
		.leftJoin(vehicles, eq(vehicles.id, orders.assignedVehicleId))
		.orderBy(desc(orders.createdAt));

	const locations = await db.select().from(orderLocations);
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
		orders: orderRows.map((order) => ({
			...order,
			locations: locationsByOrder.get(order.id) ?? {}
		}))
	};
};
