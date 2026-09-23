import type { APIRoute } from 'astro';
import { apiFetch, forwardedResponse, API_CONFIGURATION_ERROR, json } from '../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const response = await apiFetch(context, '/api/version');
	if (response === API_CONFIGURATION_ERROR) {
		return json({ error: 'Server authentication is not configured.' }, 503);
	}
	if (response === null) {
		return json({ error: 'Game server is currently unreachable.' }, 503);
	}
	return forwardedResponse(response);
};
