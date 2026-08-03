import type { APIRoute } from 'astro';
import { API_CONFIGURATION_ERROR, apiFetch, authenticatedApiFetch, forwardedResponse, json, SESSION_COOKIE } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const token = context.cookies.get(SESSION_COOKIE)?.value;
	if (!token) return json({ error: 'Not authenticated.' }, 401);

	let response = await authenticatedApiFetch(context, '/me');
	// Some server builds only understand the legacy query token, signaled by a
	// 400 (missing token) since the Authorization header is ignored.
	if (response instanceof Response && response.status === 400) {
		response = await apiFetch(context, `/me?token=${encodeURIComponent(token)}`);
	}
	if (response !== API_CONFIGURATION_ERROR && response?.status === 401) {
		context.cookies.delete(SESSION_COOKIE, { path: '/' });
	}
	return forwardedResponse(response);
};
