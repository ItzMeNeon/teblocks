import type { APIRoute } from 'astro';
import { apiFetch, json, SESSION_COOKIE, API_CONFIGURATION_ERROR } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async (context) => {
	context.cookies.delete(SESSION_COOKIE, { path: '/' });
	const token = context.cookies.get(SESSION_COOKIE)?.value;
	if (!token) return json({ status: 'signed_out' });

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 6000);
		const response = await apiFetch(context, '/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal });
		clearTimeout(timeout);
		if (response === null) return json({ status: 'signed_out', warning: 'Backend unreachable; cookie cleared locally.' }, 200);
		if (response === API_CONFIGURATION_ERROR) return json({ status: 'signed_out' }, 200);
		await response.text().catch(() => '');
	} catch {
		// Backend call failed; local cookie deletion already happened above.
	}
	return json({ status: 'signed_out' });
};
