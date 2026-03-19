import { error, redirect, type RequestEvent } from '@sveltejs/kit';

import type { UserRole } from '$lib/server/db/schema';

export function requireUser(event: RequestEvent) {
	if (!event.locals.user) {
		throw redirect(303, '/login');
	}

	return event.locals.user;
}

export function requireRole(event: RequestEvent, role: UserRole) {
	const user = requireUser(event);

	if (user.role !== role) {
		throw error(403, 'You do not have access to this area.');
	}

	return user;
}
