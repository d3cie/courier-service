import { fail } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';

import { db } from '$lib/server/db/client';
import { vehicleTemplates } from '$lib/server/db/catalog';
import { calculateVolumeCm3, getVehicleTemplate } from '$lib/server/domain/capacity';
import { assignmentOffers, driverAvailability, vehicles } from '$lib/server/db/schema';
import { createCourierServices } from '$lib/server/services/container';
import { getDriverContextForUser } from '$lib/server/services/current-driver';

function parseNumber(value: FormDataEntryValue | null) {
	if (!value) {
		return null;
	}

	const parsed = Number.parseFloat(String(value));
	return Number.isFinite(parsed) ? parsed : null;
}

export const load = async ({ locals }) => {
	const { driver, availability } = await getDriverContextForUser(locals.user!.id);
	const vehicleRows = await db
		.select()
		.from(vehicles)
		.where(eq(vehicles.driverId, driver.id))
		.orderBy(desc(vehicles.createdAt));

	return {
		driver,
		availability,
		vehicles: vehicleRows,
		vehicleTemplates
	};
};

export const actions = {
	addVehicle: async ({ request, locals }) => {
		const { driver } = await getDriverContextForUser(locals.user!.id);
		const form = await request.formData();
		const templateKey = String(form.get('templateKey') ?? '');
		const name = String(form.get('name') ?? '').trim();
		const registrationNumber = String(form.get('registrationNumber') ?? '').trim();
		const template = getVehicleTemplate(templateKey);

		if (!template || !name) {
			return fail(400, {
				error: 'Vehicle name and template are required.'
			});
		}

		const maxLengthCm = parseNumber(form.get('maxLengthCm')) ?? template.maxLengthCm;
		const maxWidthCm = parseNumber(form.get('maxWidthCm')) ?? template.maxWidthCm;
		const maxHeightCm = parseNumber(form.get('maxHeightCm')) ?? template.maxHeightCm;
		const maxWeightKg = parseNumber(form.get('maxWeightKg')) ?? template.maxWeightKg;

		await db.insert(vehicles).values({
			driverId: driver.id,
			name,
			registrationNumber: registrationNumber || null,
			templateKey: template.key,
			capacityTier: template.capacityTier,
			maxLengthCm: Math.round(maxLengthCm),
			maxWidthCm: Math.round(maxWidthCm),
			maxHeightCm: Math.round(maxHeightCm),
			maxWeightKg,
			maxVolumeCm3: calculateVolumeCm3(
				Math.round(maxLengthCm),
				Math.round(maxWidthCm),
				Math.round(maxHeightCm)
			),
			isActive: false
		});

		return { success: true };
	},

	setActiveVehicle: async ({ request, locals }) => {
		const { driver, availability } = await getDriverContextForUser(locals.user!.id);
		const form = await request.formData();
		const vehicleId = String(form.get('vehicleId') ?? '');
		const [vehicle] = await db
			.select()
			.from(vehicles)
			.where(and(eq(vehicles.id, vehicleId), eq(vehicles.driverId, driver.id)))
			.limit(1);

		if (!vehicle) {
			return fail(400, {
				error: 'That vehicle does not belong to you.'
			});
		}

		await db
			.update(vehicles)
			.set({ isActive: false, updatedAt: new Date().toISOString() })
			.where(eq(vehicles.driverId, driver.id));
		await db
			.update(vehicles)
			.set({ isActive: true, updatedAt: new Date().toISOString() })
			.where(eq(vehicles.id, vehicleId));

		if (availability) {
			await db
				.update(driverAvailability)
				.set({ activeVehicleId: vehicleId, updatedAt: new Date().toISOString() })
				.where(eq(driverAvailability.driverId, driver.id));
		}

		return { success: true };
	},

	updateAvailability: async ({ request, locals }) => {
		const { driver, availability } = await getDriverContextForUser(locals.user!.id);
		const form = await request.formData();
		const mode = String(form.get('mode') ?? 'offline');
		const latitude = parseNumber(form.get('latitude'));
		const longitude = parseNumber(form.get('longitude'));
		const activeVehicleId =
			String(form.get('activeVehicleId') ?? '').trim() || availability?.activeVehicleId || null;

		if (mode === 'online') {
			if (!activeVehicleId) {
				return fail(400, {
					error: 'Choose an active vehicle before going online.'
				});
			}

			if (latitude === null || longitude === null) {
				return fail(400, {
					error: 'A current location is required before you can go online.'
				});
			}

			await db
				.update(driverAvailability)
				.set({
					isOnline: true,
					availabilityStatus: 'idle',
					activeVehicleId,
					currentLatitude: latitude,
					currentLongitude: longitude,
					lastLocationAt: new Date().toISOString(),
					lastStatusAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				})
				.where(eq(driverAvailability.driverId, driver.id));

			return { success: true };
		}

		const pendingOffers = await db
			.select({ id: assignmentOffers.id })
			.from(assignmentOffers)
			.where(and(eq(assignmentOffers.driverId, driver.id), eq(assignmentOffers.status, 'pending')));
		const { assignmentEngine } = createCourierServices();

		for (const offer of pendingOffers) {
			await assignmentEngine.rejectOffer(offer.id, driver.id);
		}

		await db
			.update(driverAvailability)
			.set({
				isOnline: false,
				availabilityStatus: 'offline',
				lastStatusAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			})
			.where(eq(driverAvailability.driverId, driver.id));

		return { success: true };
	}
};
