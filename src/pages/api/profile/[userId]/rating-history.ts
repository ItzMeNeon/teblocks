import type { APIRoute } from 'astro';
import { authenticatedApiFetch, forwardedResponse } from '../../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const userId = context.params.id;
	const query = new URL(context.request.url).searchParams;
	const days = query.get('days') ?? '30';
	const search = new URLSearchParams({ days });
	return forwardedResponse(await authenticatedApiFetch(context, `/users/${userId}/rating-history?${search}`));
};
