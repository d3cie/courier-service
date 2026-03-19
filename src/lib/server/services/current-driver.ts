import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db/client';
import { driverAvailability, drivers } from '$lib/server/db/schema';

export async function getDriverContextForUser(userId: string) {
	const [driver] = await db.select().from(drivers).where(eq(drivers.userId, userId)).limit(1);

	if (!driver) {
		throw error(404, 'Driver profile not found.');
	}

	const [availability] = await db
		.select()
		.from(driverAvailability)
		.where(eq(driverAvailability.driverId, driver.id))
		.limit(1);

	return {
		driver,
		availability: availability ?? null
	};
}
