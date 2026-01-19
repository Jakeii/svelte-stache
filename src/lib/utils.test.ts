import { describe, expect, it } from 'vitest';
import { hashKey } from './utils';

describe('hashKey function', () => {
	it('should create consistent keys for primitives', () => {
		expect(hashKey('test')).toBe('"test"');
		expect(hashKey(123)).toBe('123');
		expect(hashKey(true)).toBe('true');
		expect(hashKey(null)).toBe('null');
	});

	it('should create consistent keys for arrays', () => {
		expect(hashKey([1, 2, 3])).toBe('[1,2,3]');
		expect(hashKey(['a', 'b'])).toBe('["a","b"]');
	});

	it('should create consistent keys for objects regardless of property order', () => {
		const obj1 = { a: 1, b: 2, c: 3 };
		const obj2 = { c: 3, a: 1, b: 2 };
		expect(hashKey(obj1)).toBe(hashKey(obj2));
	});

	it('should handle nested objects', () => {
		const obj1 = { user: { id: 1, name: 'John' }, active: true };
		const obj2 = { active: true, user: { name: 'John', id: 1 } };
		expect(hashKey(obj1)).toBe(hashKey(obj2));
	});
});
