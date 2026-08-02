import type { APIRoute } from 'astro';
import { authenticatedApiFetch, forwardedResponse } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const query = new URL(context.request.url).searchParams;
	const limit = query.get('limit') ?? '8';
	const cursor = query.get('cursor');
	const search = new URLSearchParams({ limit });
	if (cursor) search.set('cursor', cursor);
	return forwardedResponse(await authenticatedApiFetch(context, `/profile/me/matches?${search}`));
};
