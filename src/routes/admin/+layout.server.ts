import { requireRole } from '$lib/server/auth/guards';

export const load = async (event) => {
	requireRole(event, 'admin');
	return {};
};
