import type { APIRoute } from 'astro';
import { apiFetch, json, forwardedResponse, API_CONFIGURATION_ERROR } from '../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const query = new URL(context.request.url).searchParams;
	const date = query.get('date');
	const path = date ? `/api/daily?date=${encodeURIComponent(date)}` : '/api/daily';

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 8000);
		const response = await apiFetch(context, path, { signal: controller.signal });
		clearTimeout(timeout);

		if (response === null) return json({ error: 'Daily challenge service is unavailable.' }, 503);
		if (response === API_CONFIGURATION_ERROR) return json({ error: 'Site authentication is not configured.' }, 503);
		return forwardedResponse(response);
	} catch {
		return json({ error: 'Daily challenge service is unavailable.' }, 503);
	}
};
