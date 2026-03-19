import { redirect } from '@sveltejs/kit';

import {
	clearSessionCookie,
	deleteSessionByToken,
	getSessionCookieName
} from '$lib/server/auth/session';

export const POST = async ({ cookies }) => {
	const token = cookies.get(getSessionCookieName());

	if (token) {
		await deleteSessionByToken(token);
	}

	clearSessionCookie(cookies);
	throw redirect(303, '/login');
};
