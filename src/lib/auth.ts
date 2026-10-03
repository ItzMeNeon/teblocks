import type { APIContext } from 'astro';

export const SESSION_COOKIE = 'teblocks_session';
export const API_CONFIGURATION_ERROR = 'API_CONFIGURATION_ERROR';

const DEFAULT_API_BASE_URL = 'https://backend.teblocks.my.id';

export function apiBaseUrl(context: APIContext) {
	const origin =
		context.locals.runtime?.env?.API_BASE_URL ??
		import.meta.env.VITE_API_BASE_URL ??
		DEFAULT_API_BASE_URL;

	if (!origin) {
		throw new Error('API_BASE_URL is not configured.');
	}

	return origin.replace(/\/+$/, '');
}

export function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json',
		},
	});
}

export async function apiFetch(
	context: APIContext,
	path: string,
	init?: RequestInit
): Promise<Response | null | typeof API_CONFIGURATION_ERROR> {
	let origin: string;

	try {
		origin = apiBaseUrl(context);
	} catch (err) {
		console.error('apiBaseUrl() failed:', err);
		return API_CONFIGURATION_ERROR;
	}

	const url = new URL(path, origin).toString();

	const headers = new Headers(init?.headers);
	if (context.request) {
		const cfIp = context.request.headers.get('CF-Connecting-IP');
		const cfCountry = context.request.headers.get('CF-IPCountry');
		const xff = context.request.headers.get('X-Forwarded-For');
		const ua = context.request.headers.get('User-Agent');
		if (cfIp && !headers.has('CF-Connecting-IP')) headers.set('CF-Connecting-IP', cfIp);
		if (cfCountry && !headers.has('CF-IPCountry')) headers.set('CF-IPCountry', cfCountry);
		if (xff && !headers.has('X-Forwarded-For')) headers.set('X-Forwarded-For', xff);
		if (ua && !headers.has('User-Agent')) headers.set('User-Agent', ua);
	}

	console.log(`[apiFetch] ${init?.method ?? 'GET'} ${url}`);

	try {
		const response = await fetch(url, {
			...init,
			headers,
		});

		console.log(
			`[apiFetch] <- ${response.status} ${response.statusText}`
		);

		return response;
	} catch (err) {
		console.error(`[apiFetch] Fetch failed for ${url}:`, err);
		return null;
	}
}

export async function authenticatedApiFetch(
	context: APIContext,
	path: string,
	init?: RequestInit
): Promise<Response | null | typeof API_CONFIGURATION_ERROR> {
	const token = context.cookies.get(SESSION_COOKIE)?.value;

	if (!token) {
		return json({ error: 'Not authenticated.' }, 401);
	}

	const headers = new Headers(init?.headers);
	headers.set('Authorization', `Bearer ${token}`);

	return apiFetch(context, path, {
		...init,
		headers,
	});
}

export async function forwardedResponse(
	response: Response | null | typeof API_CONFIGURATION_ERROR
) {
	if (response === API_CONFIGURATION_ERROR) {
		return json(
			{
				error:
					'Site authentication is not configured. Set API_BASE_URL in Cloudflare and redeploy.',
			},
			503
		);
	}

	if (!response) {
		return json(
			{
				error: 'Authentication service is unavailable.',
			},
			503
		);
	}

	const body = await response.text();

	console.log('[forwardedResponse] status:', response.status);
	console.log('[forwardedResponse] body:', body);

	return new Response(body, {
		status: response.status,
		headers: {
			'Content-Type':
				response.headers.get('Content-Type') ??
				'application/json',
		},
	});
}
