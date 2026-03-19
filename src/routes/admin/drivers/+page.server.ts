import { fail } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';

import { hashPassword } from '$lib/server/auth/password';
import { db } from '$lib/server/db/client';
import { driverAvailability, drivers, users, vehicles } from '$lib/server/db/schema';

export const load = async () => {
	const driverRows = await db
		.select({
			driverId: drivers.id,
			displayName: drivers.displayName,
			phone: drivers.phone,
			email: users.email,
			status: drivers.status,
			isOnline: driverAvailability.isOnline,
			availabilityStatus: driverAvailability.availabilityStatus,
			currentLatitude: driverAvailability.currentLatitude,
			currentLongitude: driverAvailability.currentLongitude
		})
		.from(drivers)
		.innerJoin(users, eq(users.id, drivers.userId))
		.leftJoin(driverAvailability, eq(driverAvailability.driverId, drivers.id))
		.orderBy(desc(drivers.createdAt));

	const vehicleRows = await db.select().from(vehicles).orderBy(desc(vehicles.createdAt));
	const vehiclesByDriver = new Map<string, typeof vehicleRows>();

	for (const vehicle of vehicleRows) {
		const current = vehiclesByDriver.get(vehicle.driverId) ?? [];
		current.push(vehicle);
		vehiclesByDriver.set(vehicle.driverId, current);
	}

	return {
		drivers: driverRows.map((driver) => ({
			...driver,
			vehicles: vehiclesByDriver.get(driver.driverId) ?? []
		}))
	};
};

export const actions = {
	createDriver: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		const phone = String(form.get('phone') ?? '').trim();
		const password = String(form.get('password') ?? '');

		if (!name || !email || password.length < 8) {
			return fail(400, {
				error: 'Name, email, and a password of at least 8 characters are required.'
			});
		}

		const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

		if (existing[0]) {
			return fail(400, {
				error: 'A user with that email already exists.'
			});
		}

		const [user] = await db
			.insert(users)
			.values({
				name,
				email,
				phone,
				passwordHash: hashPassword(password),
				role: 'driver'
			})
			.returning({ id: users.id });

		const [driver] = await db
			.insert(drivers)
			.values({
				userId: user.id,
				displayName: name,
				phone
			})
			.returning({ id: drivers.id });

		await db.insert(driverAvailability).values({
			driverId: driver.id,
			isOnline: false,
			availabilityStatus: 'offline'
		});

		return { success: true };
	}
};
