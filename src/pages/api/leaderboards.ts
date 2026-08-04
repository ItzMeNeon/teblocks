import type { APIRoute } from 'astro';
import { apiFetch, json, forwardedResponse, API_CONFIGURATION_ERROR } from '../../lib/auth';

export const prerender = false;

const VALID_MODES = ['ranked_1v1', 'quick_play', 'battle_royale'] as const;
type ValidMode = (typeof VALID_MODES)[number];

export const GET: APIRoute = async (context) => {
	const query = new URL(context.request.url).searchParams;
	const mode = query.get('mode') as ValidMode | null;
	if (!mode || !VALID_MODES.includes(mode)) {
		return json({ error: `Invalid mode. Use one of: ${VALID_MODES.join(', ')}` }, 400);
	}
	const limit = Math.min(50, Math.max(1, parseInt(query.get('limit') || '20', 10) || 20));
	const search = new URLSearchParams({ mode, limit: String(limit) });
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 8000);
		const response = await apiFetch(context, `/leaderboards?${search}`, { signal: controller.signal });
		clearTimeout(timeout);
		if (response === null) return json({ error: 'Leaderboard service is unavailable.' }, 503);
		if (response === API_CONFIGURATION_ERROR) return json({ error: 'Site authentication is not configured.' }, 503);
		if (response.status === 404 || response.status === 405) return json({ error: 'Leaderboards are not yet available on the server.' }, 503);
		if (response.status >= 500) return json({ error: 'Leaderboard service error.' }, response.status);
		return forwardedResponse(response);
	} catch {
		return json({ error: 'Leaderboard service is unavailable.' }, 503);
	}
};