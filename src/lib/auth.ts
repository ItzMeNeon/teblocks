import type { APIContext } from 'astro';

export const SESSION_COOKIE = 'teblocks_session';

export function apiBaseUrl(context: APIContext) {
	const origin = context.locals.runtime.env.API_BASE_URL;
	if (!origin) throw new Error('API_BASE_URL is not configured.');
	return origin.replace(/\/+$/, '');
}

export function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export async function apiFetch(context: APIContext, path: string, init?: RequestInit) {
	try {
		return await fetch(`${apiBaseUrl(context)}${path}`, init);
	} catch {
		return null;
	}
}

export async function forwardedResponse(response: Response | null) {
	if (!response) return json({ error: 'Authentication service is unavailable.' }, 503);
	const body = await response.text();
	return new Response(body, {
		status: response.status,
		headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' },
	});
}
