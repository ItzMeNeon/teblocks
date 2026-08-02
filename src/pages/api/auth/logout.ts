import type { APIRoute } from 'astro';
import { json, SESSION_COOKIE } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async (context) => {
	context.cookies.delete(SESSION_COOKIE, { path: '/' });
	return json({ status: 'signed_out' });
};
