import type { APIRoute } from 'astro';
import { authenticatedApiFetch, forwardedResponse, json } from '../../../../lib/auth';

export const prerender = false;

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const POST: APIRoute = async (context) => {
	const kind = context.params.kind;
	if (kind !== 'avatar' && kind !== 'banner') return json({ error: 'Unknown media type.' }, 404);
	const contentType = context.request.headers.get('Content-Type');
	if (!contentType?.startsWith('multipart/form-data')) return json({ error: 'Expected multipart form data.' }, 400);

	const body = await context.request.arrayBuffer();
	if (body.byteLength > MAX_UPLOAD_BYTES) {
		return json({ error: 'Image must be 5 MB or smaller.' }, 413);
	}
	return forwardedResponse(await authenticatedApiFetch(context, `/profile/me/${kind}`, {
		method: 'POST',
		headers: { 'Content-Type': contentType },
		body,
	}));
};
