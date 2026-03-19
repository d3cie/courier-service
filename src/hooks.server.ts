import type { Handle } from '@sveltejs/kit';

import { ensureDatabaseReady } from '$lib/server/db/bootstrap';
import { getSessionCookieName, resolveSession } from '$lib/server/auth/session';

export const handle: Handle = async ({ event, resolve }) => {
	await ensureDatabaseReady();

	const token = event.cookies.get(getSessionCookieName());
	const { session, user } = await resolveSession(token);

	event.locals.session = session;
	event.locals.user = user;

	return resolve(event);
};
