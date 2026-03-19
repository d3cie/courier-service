// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { UserRole } from '$lib/server/db/schema';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: {
				id: string;
				userId: string;
				expiresAt: string;
			} | null;
			user: {
				id: string;
				name: string;
				email: string;
				role: UserRole;
			} | null;
		}
		interface PageData {
			user: {
				id: string;
				name: string;
				email: string;
				role: UserRole;
			} | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
