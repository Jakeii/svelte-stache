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

export { hashKey };
