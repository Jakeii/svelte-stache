function isPlainObject(x: unknown) {
	if (Object.prototype.toString.call(x) !== '[object Object]') {
		return false;
	}
	const prototype = Object.getPrototypeOf(x);
	return prototype === null || prototype === Object.prototype;
}

function hashKey(queryKey?: unknown[] | unknown): string {
	return JSON.stringify(queryKey, (_, val) =>
		isPlainObject(val)
			? Object.keys(val)
					.sort()
					.reduce(
						(result, key) => {
							result[key] = val[key];
							return result;
						},
						{} as Record<string, unknown>
					)
			: val
	);
}

const SSR_INVALIDATE_WARNING =
	'invalidate() was called during SSR and has no effect. Invalidate in the browser instead, e.g. in an event handler or mutation callback.';

export { hashKey, SSR_INVALIDATE_WARNING };
