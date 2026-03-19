import { fail, redirect } from '@sveltejs/kit';

import { authenticateUser, createSession, setSessionCookie } from '$lib/server/auth/session';

export const load = async ({ locals }) => {
	if (locals.user) {
		throw redirect(303, locals.user.role === 'admin' ? '/admin/orders' : '/driver/offers');
	}

	return {};
};

export const actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');

		if (!email || !password) {
			return fail(400, {
				error: 'Email and password are required.',
				email
			});
		}

		const user = await authenticateUser(email, password);

		if (!user) {
			return fail(400, {
				error: 'The credentials did not match an account.',
				email
			});
		}

		const { token, session } = await createSession(user.id);
		setSessionCookie(cookies, token, session.expiresAt);

		throw redirect(303, user.role === 'admin' ? '/admin/orders' : '/driver/offers');
	}
};
