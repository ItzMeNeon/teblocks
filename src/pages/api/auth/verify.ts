import type { APIRoute } from 'astro';
import { apiFetch, forwardedResponse, json } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async (context) => {
	let body: unknown;
	try {
		body = await context.request.json();
	} catch {
		return json({ error: 'Malformed request.' }, 400);
	}

	return forwardedResponse(await apiFetch(context, '/verify', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	}));
};
