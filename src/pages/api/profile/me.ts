import type { APIRoute } from 'astro';
import { authenticatedApiFetch, forwardedResponse, SESSION_COOKIE } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const response = await authenticatedApiFetch(context, '/profile/me');
	if (response instanceof Response && response.status === 401) context.cookies.delete(SESSION_COOKIE, { path: '/' });
	return forwardedResponse(response);
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
