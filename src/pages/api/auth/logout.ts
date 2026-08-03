import type { APIRoute } from 'astro';
import { apiFetch, json, SESSION_COOKIE, API_CONFIGURATION_ERROR } from '../../../lib/auth';

export const prerender = false;

async function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
	let timeout: ReturnType<typeof setTimeout>;
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeout = setTimeout(() => reject(new Error('Request timed out.')), ms);
	});
	try {
		return await Promise.race([promise, timeoutPromise]);
	} finally {
		clearTimeout(timeout);
	}
}

export const POST: APIRoute = async (context) => {
	context.cookies.delete(SESSION_COOKIE, { path: '/' });
	const token = context.cookies.get(SESSION_COOKIE)?.value;
	if (!token) return json({ status: 'signed_out' });

	try {
		const response = await withTimeout(
			apiFetch(context, '/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } }),
			6000
		);
		if (response === null) return json({ status: 'signed_out', warning: 'Backend unreachable; cookie cleared locally.' }, 200);
		if (response === API_CONFIGURATION_ERROR) return json({ status: 'signed_out' }, 200);
		await response.text().catch(() => '');
	} catch {
		// Backend call failed; local cookie deletion already happened above.
	}
	return json({ status: 'signed_out' });
};
