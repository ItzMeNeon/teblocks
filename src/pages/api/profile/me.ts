import type { APIRoute } from 'astro';
import { authenticatedApiFetch, forwardedResponse } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async (context) => forwardedResponse(await authenticatedApiFetch(context, '/profile/me'));

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
