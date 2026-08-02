import type { APIRoute } from 'astro';
import { API_CONFIGURATION_ERROR, apiFetch, json, SESSION_COOKIE } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async (context) => {
	let body: unknown;
	try {
		body = await context.request.json();
	} catch {
		return json({ error: 'Malformed request.' }, 400);
	}

	const response = await apiFetch(context, '/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	if (response === API_CONFIGURATION_ERROR) {
		return json({ error: 'Site authentication is not configured. Set API_BASE_URL in Cloudflare and redeploy.' }, 503);
	}
	if (!response) return json({ error: 'Authentication service is unavailable.' }, 503);

	const responseBody = await response.json().catch(() => null) as { token?: unknown; error?: string } | null;
	if (!response.ok) return json(responseBody ?? { error: 'Login failed.' }, response.status);
	if (!responseBody?.token || typeof responseBody.token !== 'string') {
		return json({ error: 'Authentication service returned an invalid response.' }, 502);
	}

	context.cookies.set(SESSION_COOKIE, responseBody.token, {
		httpOnly: true,
		path: '/',
		sameSite: 'lax',
		secure: context.url.protocol === 'https:',
	});
	return json({ status: 'authenticated' });
};
