import type { APIRoute } from 'astro';
import { apiFetch, forwardedResponse, API_CONFIGURATION_ERROR } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const response = await apiFetch(context, '/online');
	if (response === API_CONFIGURATION_ERROR) {
		return new Response(JSON.stringify({ count: 0, history: [], players: [] }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	}
	if (response === null) {
		return new Response(JSON.stringify({ count: 0, history: [], players: [] }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	}
	return forwardedResponse(response);
};
