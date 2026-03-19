import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestContext } from '$lib/server/testing/setup';

describe('AssignmentEngine', () => {
	beforeEach(() => {
		process.env.DEFAULT_ADMIN_EMAIL = 'admin@example.com';
		process.env.DEFAULT_ADMIN_PASSWORD = 'admin1234';
		process.env.DEFAULT_DRIVER_PASSWORD = 'driver1234';
	});

	it('prefers the smallest sufficient vehicle before a larger but closer one', async () => {
		const { db, schema, services } = await createTestContext();
		const drivers = await db.select().from(schema.drivers);
		const vehicles = await db.select().from(schema.vehicles);

		for (const driver of drivers) {
			const vehicle = vehicles.find((entry) => entry.driverId === driver.id);
			await db
				.update(schema.driverAvailability)
				.set({
					isOnline: true,
					availabilityStatus: 'idle',
					activeVehicleId: vehicle?.id ?? null,
					currentLatitude: vehicle?.templateKey === 'honda-fit' ? -17.78 : -17.829,
					currentLongitude: vehicle?.templateKey === 'honda-fit' ? 31.02 : 31.052,
					lastLocationAt: new Date().toISOString(),
					lastStatusAt: new Date(Date.now() - 10 * 60_000).toISOString(),
					updatedAt: new Date().toISOString()
				})
				.where(eq(schema.driverAvailability.driverId, driver.id));
		}

		const [microPreset] = await db
			.select()
			.from(schema.packageSizePresets)
			.where(eq(schema.packageSizePresets.key, 'micro'))
			.limit(1);
		const [order] = await db
			.insert(schema.orders)
			.values({
				customerJid: '263700000100@c.us',
				customerPhone: '263700000100',
				status: 'dispatching',
				packagePresetId: microPreset.id,
				packageLengthCm: 25,
				packageWidthCm: 20,
				packageHeightCm: 10,
				packageWeightKg: 2,
				packageVolumeCm3: 5000
			})
			.returning({ id: schema.orders.id });

		await db.insert(schema.orderLocations).values({
			orderId: order.id,
			kind: 'pickup',
			latitude: -17.829,
			longitude: 31.052
		});

		const ranked = await services.assignmentEngine.rankCandidates(order.id);
		const [firstVehicle] = await db
			.select()
			.from(schema.vehicles)
			.where(eq(schema.vehicles.id, ranked[0].vehicleId))
			.limit(1);

		expect(firstVehicle.templateKey).toBe('honda-fit');
	});

	it('filters out undersized vehicles for oversized cargo', async () => {
		const { db, schema, services } = await createTestContext();
		const drivers = await db.select().from(schema.drivers);
		const vehicles = await db.select().from(schema.vehicles);

		for (const driver of drivers) {
			const vehicle = vehicles.find((entry) => entry.driverId === driver.id);
			await db
				.update(schema.driverAvailability)
				.set({
					isOnline: true,
					availabilityStatus: 'idle',
					activeVehicleId: vehicle?.id ?? null,
					currentLatitude: -17.829,
					currentLongitude: 31.052,
					lastLocationAt: new Date().toISOString(),
					lastStatusAt: new Date(Date.now() - 10 * 60_000).toISOString(),
					updatedAt: new Date().toISOString()
				})
				.where(eq(schema.driverAvailability.driverId, driver.id));
		}

		const [oversizedPreset] = await db
			.select()
			.from(schema.packageSizePresets)
			.where(eq(schema.packageSizePresets.key, 'oversized'))
			.limit(1);
		const [order] = await db
			.insert(schema.orders)
			.values({
				customerJid: '263700000200@c.us',
				customerPhone: '263700000200',
				status: 'dispatching',
				packagePresetId: oversizedPreset.id,
				packageLengthCm: 300,
				packageWidthCm: 120,
				packageHeightCm: 60,
				packageWeightKg: 600,
				packageVolumeCm3: 2160000
			})
			.returning({ id: schema.orders.id });

		await db.insert(schema.orderLocations).values({
			orderId: order.id,
			kind: 'pickup',
			latitude: -17.829,
			longitude: 31.052
		});

		const ranked = await services.assignmentEngine.rankCandidates(order.id);
		const rankedVehicles = await Promise.all(
			ranked.map((candidate) =>
				db
					.select()
					.from(schema.vehicles)
					.where(eq(schema.vehicles.id, candidate.vehicleId))
					.limit(1)
			)
		);

		expect(rankedVehicles.flat().map((vehicle) => vehicle.templateKey)).toEqual(['box-truck']);
	});
});
