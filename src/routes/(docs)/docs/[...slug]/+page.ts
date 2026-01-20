import { getDoc } from '$lib/docs/utils';

export async function load({ params }) {
	return getDoc(params.slug);
}
