import type { APIRoute } from 'astro';
import { apiFetch, forwardedResponse, json, SESSION_COOKIE } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const token = context.cookies.get(SESSION_COOKIE)?.value;
	if (!token) return json({ error: 'Not authenticated.' }, 401);

	const response = await apiFetch(context, `/me?token=${encodeURIComponent(token)}`);
	if (response?.status === 401) {
		context.cookies.delete(SESSION_COOKIE, { path: '/' });
	}
	return forwardedResponse(response);
};
