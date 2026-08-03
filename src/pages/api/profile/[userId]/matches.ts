import type { APIRoute } from 'astro';
import { apiFetch, json, forwardedResponse } from '../../../../lib/auth';

export const prerender = false;

async function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
	let timeout: ReturnType<typeof setTimeout>;
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeout = setTimeout(() => reject(new Error('Request timed out.')), ms);
	});
	try {
		return await Promise.race([promise, timeoutPromise]);
	} finally {
		clearTimeout(timeout);
	}
}

export const GET: APIRoute = async (context) => {
	const userId = context.params.userId;
	if (!userId || typeof userId !== 'string' || userId.length < 1) {
		return json({ error: 'User ID is required.' }, 400);
	}
	const query = new URL(context.request.url).searchParams;
	const limit = Math.min(50, Math.max(1, parseInt(query.get('limit') || '8', 10) || 8));
	const cursor = query.get('cursor');
	const search = new URLSearchParams({ limit: String(limit) });
	if (cursor) search.set('cursor', cursor);
	const response = await withTimeout(apiFetch(context, `/users/${encodeURIComponent(userId)}/matches?${search}`), 8000);
	if (response === null) return json({ error: 'Match service is unavailable.' }, 503);
	if (response === API_CONFIGURATION_ERROR) return json({ error: 'Site authentication is not configured.' }, 503);
	if (response.status === 404) return json({ error: 'Player not found.' }, 404);
	if (response.status === 405) return json({ error: 'Public match history is not yet available on the server.' }, 503);
	if (response.status >= 500) return json({ error: 'Match service error.' }, response.status);
	return forwardedResponse(response);
};
