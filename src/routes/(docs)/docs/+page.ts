import { getDoc } from '$lib/docs/utils';

export async function load() {
	return getDoc();
}
