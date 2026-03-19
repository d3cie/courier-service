import { createHash, randomBytes } from 'node:crypto';

import { and, eq, gt } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';

import { db } from '$lib/server/db/client';
import { sessions, users } from '$lib/server/db/schema';

import { verifyPassword } from './password';

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? 'courier_session';
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? '30');

function sessionLifetimeMs() {
	return SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
}

function hashToken(token: string) {
	return createHash('sha256').update(token).digest('hex');
}

export function getSessionCookieName() {
	return SESSION_COOKIE_NAME;
}

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: string) {
	cookies.set(SESSION_COOKIE_NAME, token, {
		httpOnly: true,
		path: '/',
		sameSite: 'lax',
		secure: false,
		expires: new Date(expiresAt)
	});
}

export function clearSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}

export async function createSession(userId: string) {
	const token = randomBytes(32).toString('hex');
	const expiresAt = new Date(Date.now() + sessionLifetimeMs()).toISOString();
	const inserted = await db
		.insert(sessions)
		.values({
			userId,
			tokenHash: hashToken(token),
			expiresAt
		})
		.returning({
			id: sessions.id,
			userId: sessions.userId,
			expiresAt: sessions.expiresAt
		});

	return { token, session: inserted[0] };
}

export async function deleteSessionByToken(token: string) {
	await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function authenticateUser(email: string, password: string) {
	const record = await db
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
			role: users.role,
			passwordHash: users.passwordHash
		})
		.from(users)
		.where(eq(users.email, email.toLowerCase().trim()))
		.limit(1);

	const user = record[0];

	if (!user || !verifyPassword(password, user.passwordHash)) {
		return null;
	}

	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role
	};
}

export async function resolveSession(token: string | undefined) {
	if (!token) {
		return { session: null, user: null };
	}

	const nowIso = new Date().toISOString();
	const record = await db
		.select({
			sessionId: sessions.id,
			userId: sessions.userId,
			expiresAt: sessions.expiresAt,
			userName: users.name,
			userEmail: users.email,
			userRole: users.role
		})
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, nowIso)))
		.limit(1);

	const current = record[0];

	if (!current) {
		await deleteSessionByToken(token);
		return { session: null, user: null };
	}

	return {
		session: {
			id: current.sessionId,
			userId: current.userId,
			expiresAt: current.expiresAt
		},
		user: {
			id: current.userId,
			name: current.userName,
			email: current.userEmail,
			role: current.userRole
		}
	};
}
