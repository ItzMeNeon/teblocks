import type { APIRoute } from 'astro';
import { apiFetch, json, forwardedResponse, API_CONFIGURATION_ERROR } from '../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const query = new URL(context.request.url).searchParams;
	const q = query.get('q')?.trim();
	if (!q || q.length < 2) {
		return json({ error: 'Search query must be at least 2 characters. Use ?q=username' }, 400);
	}
	if (q.length > 24) {
		return json({ error: 'Search query must be 24 characters or fewer.' }, 400);
	}
	const limit = Math.min(20, Math.max(1, parseInt(query.get('limit') || '10', 10) || 10));
	const search = new URLSearchParams({ q, limit: String(limit) });
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 8000);
		const response = await apiFetch(context, `/users?${search}`, { signal: controller.signal });
		clearTimeout(timeout);
		if (response === null) return json({ error: 'User search is unavailable.' }, 503);
		if (response === API_CONFIGURATION_ERROR) return json({ error: 'Site authentication is not configured.' }, 503);
		if (response.status === 404 || response.status === 405) return json({ entries: [] }, 200);
		if (response.status >= 500) return json({ error: 'User search failed.' }, response.status);
		return forwardedResponse(response);
	} catch {
		return json({ error: 'User search is unavailable.' }, 503);
	}
};