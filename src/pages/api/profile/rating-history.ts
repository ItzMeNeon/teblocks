import type { APIRoute } from 'astro';
import { authenticatedApiFetch, forwardedResponse } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const query = new URL(context.request.url).searchParams;
	const days = query.get('days') ?? '30';
	const search = new URLSearchParams({ days });
	return forwardedResponse(await authenticatedApiFetch(context, `/profile/me/rating-history?${search}`));
};
