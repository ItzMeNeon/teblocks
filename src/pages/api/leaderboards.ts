import type { APIRoute } from 'astro';
import { apiFetch, json, forwardedResponse } from '../../lib/auth';

export const prerender = false;

const VALID_MODES = ['ranked_1v1', 'quick_play', 'battle_royale'] as const;
type ValidMode = (typeof VALID_MODES)[number];

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
	const query = new URL(context.request.url).searchParams;
	const mode = query.get('mode') as ValidMode | null;
	if (!mode || !VALID_MODES.includes(mode)) {
		return json({ error: `Invalid mode. Use one of: ${VALID_MODES.join(', ')}` }, 400);
	}
	const limit = Math.min(50, Math.max(1, parseInt(query.get('limit') || '20', 10) || 20));
	const search = new URLSearchParams({ mode, limit: String(limit) });
	const response = await withTimeout(apiFetch(context, `/leaderboards?${search}`), 8000);
	if (response === null) return json({ error: 'Leaderboard service is unavailable.' }, 503);
	if (response === API_CONFIGURATION_ERROR) return json({ error: 'Site authentication is not configured.' }, 503);
	if (response.status === 404 || response.status === 405) return json({ error: 'Leaderboards are not yet available on the server.' }, 503);
	if (response.status >= 500) return json({ error: 'Leaderboard service error.' }, response.status);
	return forwardedResponse(response);
};
