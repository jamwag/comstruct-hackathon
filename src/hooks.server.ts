import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import * as auth from '$lib/server/auth';

const handleAuth: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get(auth.sessionCookieName);

	if (!sessionToken) {
		event.locals.user = null;
		event.locals.session = null;

		return resolve(event);
	}

	const { session, user } = await auth.validateSessionToken(sessionToken);

	if (session) {
		auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
	} else {
		auth.deleteSessionTokenCookie(event);
	}

	event.locals.user = user;
	event.locals.session = session;

	return resolve(event);
};

const handleRouteProtection: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	const user = event.locals.user;

	// Protect /worker/* routes
	if (pathname.startsWith('/worker')) {
		if (!user) {
			throw redirect(302, '/login');
		}
		if (user.role !== 'worker') {
			throw redirect(302, '/manager');
		}
	}

	// Protect /manager/* routes
	if (pathname.startsWith('/manager')) {
		if (!user) {
			throw redirect(302, '/login');
		}
		if (user.role !== 'manager') {
			throw redirect(302, '/worker');
		}
	}

	return resolve(event);
};

export const handle: Handle = sequence(handleAuth, handleRouteProtection);
