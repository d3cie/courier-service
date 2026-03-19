import { and, eq } from 'drizzle-orm';

import { hashPassword } from '$lib/server/auth/password';
import { calculateVolumeCm3, getVehicleTemplate } from '$lib/server/domain/capacity';

import { db } from './client';
import { driverDemoProfiles, packagePresetSeeds } from './catalog';
import {
	driverAvailability,
	drivers,
	integrationConnections,
	packageSizePresets,
	users,
	vehicles
} from './schema';

async function ensurePackagePresets() {
	const existing = await db.select().from(packageSizePresets);

	if (existing.length > 0) {
		return;
	}

	await db.insert(packageSizePresets).values(
		packagePresetSeeds.map((preset) => ({
			...preset,
			maxVolumeCm3: calculateVolumeCm3(preset.maxLengthCm, preset.maxWidthCm, preset.maxHeightCm)
		}))
	);
}

async function ensureAdminUser() {
	const email = process.env.DEFAULT_ADMIN_EMAIL ?? 'admin@example.com';
	const password = process.env.DEFAULT_ADMIN_PASSWORD ?? 'admin1234';
	const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

	if (existing[0]) {
		return;
	}

	await db.insert(users).values({
		name: 'Dispatch Admin',
		email,
		phone: '+263770000000',
		passwordHash: hashPassword(password),
		role: 'admin'
	});
}

async function ensureDriverUsers() {
	const password = process.env.DEFAULT_DRIVER_PASSWORD ?? 'driver1234';

	for (const [index, profile] of driverDemoProfiles.entries()) {
		const existingUser = await db
			.select()
			.from(users)
			.where(eq(users.email, profile.email))
			.limit(1);

		let userId = existingUser[0]?.id;

		if (!userId) {
			const insertedUser = await db
				.insert(users)
				.values({
					name: profile.name,
					email: profile.email,
					phone: profile.phone,
					passwordHash: hashPassword(password),
					role: 'driver'
				})
				.returning({ id: users.id });

			userId = insertedUser[0].id;
		}

		const existingDriver = await db
			.select()
			.from(drivers)
			.where(eq(drivers.userId, userId))
			.limit(1);
		let driverId = existingDriver[0]?.id;

		if (!driverId) {
			const insertedDriver = await db
				.insert(drivers)
				.values({
					userId,
					displayName: profile.name,
					phone: profile.phone,
					notes: 'Seeded demo driver'
				})
				.returning({ id: drivers.id });

			driverId = insertedDriver[0].id;
		}

		const template = getVehicleTemplate(profile.vehicle);
		if (!template) {
			continue;
		}

		const existingVehicle = await db
			.select()
			.from(vehicles)
			.where(and(eq(vehicles.driverId, driverId), eq(vehicles.templateKey, template.key)))
			.limit(1);

		let vehicleId = existingVehicle[0]?.id;

		if (!vehicleId) {
			const insertedVehicle = await db
				.insert(vehicles)
				.values({
					driverId,
					name: `${template.label} ${index + 1}`,
					registrationNumber: `TEST-${index + 1}`,
					templateKey: template.key,
					capacityTier: template.capacityTier,
					maxLengthCm: template.maxLengthCm,
					maxWidthCm: template.maxWidthCm,
					maxHeightCm: template.maxHeightCm,
					maxWeightKg: template.maxWeightKg,
					maxVolumeCm3: calculateVolumeCm3(
						template.maxLengthCm,
						template.maxWidthCm,
						template.maxHeightCm
					),
					isActive: true
				})
				.returning({ id: vehicles.id });

			vehicleId = insertedVehicle[0].id;
		}

		const availability = await db
			.select()
			.from(driverAvailability)
			.where(eq(driverAvailability.driverId, driverId))
			.limit(1);

		if (!availability[0]) {
			await db.insert(driverAvailability).values({
				driverId,
				isOnline: false,
				availabilityStatus: 'offline',
				activeVehicleId: vehicleId
			});
		}
	}
}

async function ensureIntegrationState() {
	const existing = await db
		.select()
		.from(integrationConnections)
		.where(eq(integrationConnections.providerKey, 'whatsapp-web'))
		.limit(1);

	if (existing[0]) {
		return;
	}

	await db.insert(integrationConnections).values({
		providerKey: 'whatsapp-web',
		status: 'stopped'
	});
}

export async function seedDatabase() {
	await ensurePackagePresets();
	await ensureAdminUser();
	await ensureDriverUsers();
	await ensureIntegrationState();
}
