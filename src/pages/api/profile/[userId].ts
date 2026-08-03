import type { APIRoute } from 'astro';
import { apiFetch, json, forwardedResponse } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const userId = context.params.userId;
	if (!userId || typeof userId !== 'string' || userId.length < 1) {
		return json({ error: 'User ID is required.' }, 400);
	}
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 8000);
		const response = await apiFetch(context, `/users/${encodeURIComponent(userId)}`, { signal: controller.signal });
		clearTimeout(timeout);
		if (response === null) return json({ error: 'Profile service is unavailable.' }, 503);
		if (response === API_CONFIGURATION_ERROR) return json({ error: 'Site authentication is not configured.' }, 503);
		if (response.status === 404) return json({ error: 'Player not found.' }, 404);
		if (response.status === 405) return json({ error: 'Public profiles are not yet available on the server.' }, 503);
		if (response.status >= 500) return json({ error: 'Profile service error.' }, response.status);
		return forwardedResponse(response);
	} catch {
		return json({ error: 'Profile service is unavailable.' }, 503);
	}
};
