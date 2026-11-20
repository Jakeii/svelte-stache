import { getDoc } from '#lib/docs/utils.js';
import type { PageLoad } from './$types';

export const load = (async ({ params }) => {
	return getDoc(params.slug);
}) satisfies PageLoad;
