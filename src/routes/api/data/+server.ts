import { json, error } from '@sveltejs/kit';
import { loadGroupsData } from '$lib/data/load.js';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types.js';

const PASSWORD = env.TOP_SECRET_PASSWORD;

export const POST: RequestHandler = async ({ request }) => {
	let body: { password?: string };

	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid request body');
	}

	if (body.password !== PASSWORD) {
		error(401, 'Wrong password');
	}

	return json(loadGroupsData());
};
