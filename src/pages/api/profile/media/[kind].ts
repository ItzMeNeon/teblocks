import type { APIRoute } from 'astro';
import { authenticatedApiFetch, forwardedResponse, json } from '../../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async (context) => {
	const kind = context.params.kind;
	if (kind !== 'avatar' && kind !== 'banner') return json({ error: 'Unknown media type.' }, 404);
	const contentType = context.request.headers.get('Content-Type');
	if (!contentType?.startsWith('multipart/form-data')) return json({ error: 'Expected multipart form data.' }, 400);
	return forwardedResponse(await authenticatedApiFetch(context, `/profile/me/${kind}`, {
		method: 'POST',
		headers: { 'Content-Type': contentType },
		body: context.request.body,
		duplex: 'half',
	} as RequestInit));
};
