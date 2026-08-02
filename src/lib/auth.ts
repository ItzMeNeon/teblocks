import type { APIContext } from 'astro';

export const SESSION_COOKIE = 'teblocks_session';
export const API_CONFIGURATION_ERROR = 'API_CONFIGURATION_ERROR';
const DEFAULT_API_BASE_URL = 'https://backend.teblocks.my.id';

export function apiBaseUrl(context: APIContext) {
	const origin = context.locals.runtime?.env?.API_BASE_URL || import.meta.env.API_BASE_URL || DEFAULT_API_BASE_URL;
	if (!origin) throw new Error('API_BASE_URL is not configured.');
	return origin.replace(/\/+$/, '');
}

export function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

export async function apiFetch(context: APIContext, path: string, init?: RequestInit): Promise<Response | null | typeof API_CONFIGURATION_ERROR> {
	let origin: string;
	try {
		origin = apiBaseUrl(context);
	} catch {
		return API_CONFIGURATION_ERROR;
	}
	try {
		return await fetch(`${origin}${path}`, init);
	} catch {
		return null;
	}
}

export async function authenticatedApiFetch(context: APIContext, path: string, init?: RequestInit): Promise<Response | null | typeof API_CONFIGURATION_ERROR> {
	const token = context.cookies.get(SESSION_COOKIE)?.value;
	if (!token) return new Response(JSON.stringify({ error: 'Not authenticated.' }), { status: 401 });
	const headers = new Headers(init?.headers);
	headers.set('Authorization', `Bearer ${token}`);
	return apiFetch(context, path, { ...init, headers });
}

export async function forwardedResponse(response: Response | null | typeof API_CONFIGURATION_ERROR) {
	if (response === API_CONFIGURATION_ERROR) {
		return json({ error: 'Site authentication is not configured. Set API_BASE_URL in Cloudflare and redeploy.' }, 503);
	}
	if (!response) return json({ error: 'Authentication service is unavailable.' }, 503);
	const body = await response.text();
	return new Response(body, {
		status: response.status,
		headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' },
	});
}
