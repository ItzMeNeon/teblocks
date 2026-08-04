import type { APIRoute } from 'astro';
import { apiFetch, authenticatedApiFetch, forwardedResponse, SESSION_COOKIE } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const token = context.cookies.get(SESSION_COOKIE)?.value;
	const response = await authenticatedApiFetch(context, '/profile/me');
	// Keep the identity page usable while the extended profile endpoint rolls out.
	// The legacy endpoint already powers login/session checks and is safe to use
	// as a read-only fallback when the new route is not deployed yet.
	let profileResponse = response;
	if (token && response instanceof Response && (response.status === 404 || response.status === 405)) {
		profileResponse = await apiFetch(context, `/me?token=${encodeURIComponent(token)}`);
	}
	if (profileResponse instanceof Response && profileResponse.status === 401) context.cookies.delete(SESSION_COOKIE, { path: '/' });
	return forwardedResponse(profileResponse);
};

export const PATCH: APIRoute = async (context) => {
	let body: unknown;
	try {
		body = await context.request.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Malformed request.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
	}
	return forwardedResponse(await authenticatedApiFetch(context, '/profile/me', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	}));
};
