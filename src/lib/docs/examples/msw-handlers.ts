import { http, HttpResponse, delay } from 'msw';

// ─── Mock data fixtures ───────────────────────────────────────────────────────

export const MOCK_USERS = [
	{
		id: 'user-1',
		name: 'Alice Johnson',
		email: 'alice@example.com',
		role: 'Engineer',
		avatar: 'https://i.pravatar.cc/80?u=user-1',
		bio: 'Loves distributed systems.',
		department: 'Engineering',
		location: 'San Francisco'
	},
	{
		id: 'user-2',
		name: 'Bob Smith',
		email: 'bob@example.com',
		role: 'Designer',
		avatar: 'https://i.pravatar.cc/80?u=user-2',
		bio: 'Typography nerd.',
		department: 'Design',
		location: 'New York'
	},
	{
		id: 'user-3',
		name: 'Carol Williams',
		email: 'carol@example.com',
		role: 'Manager',
		avatar: 'https://i.pravatar.cc/80?u=user-3',
		department: 'Product',
		location: 'Austin'
	}
] as const;

export const MOCK_POSTS = Array.from({ length: 12 }, (_, i) => ({
	id: `post-${i + 1}`,
	title: `Post Title ${i + 1}`,
	excerpt: `This is a short excerpt for post ${i + 1}.`,
	author: MOCK_USERS[i % 3].name,
	category: ['Technology', 'Design', 'Business', 'Lifestyle', 'Science'][i % 5],
	publishedAt: new Date(Date.now() - i * 86400000).toISOString(),
	readTime: 3 + (i % 5)
}));

export const MOCK_DEPARTMENTS = [
	{ name: 'Engineering', location: 'San Francisco' },
	{ name: 'Design', location: 'New York' }
];

// ─── Handler option types ─────────────────────────────────────────────────────

export interface HandlerOptions {
	delayMs?: number;
	error?: boolean;
}

// ─── User handlers ────────────────────────────────────────────────────────────

export const userHandlers = (options: HandlerOptions = {}) => [
	http.get('http://localhost/users/:id', async ({ params }) => {
		if (options.delayMs) await delay(options.delayMs);
		if (options.error) return new HttpResponse(null, { status: 500 });
		const user = MOCK_USERS.find((u) => u.id === params.id) ?? MOCK_USERS[0];
		return HttpResponse.json(user);
	}),
	http.get('http://localhost/users', async ({ request }) => {
		if (options.delayMs) await delay(options.delayMs);
		if (options.error) return new HttpResponse(null, { status: 500 });
		const url = new URL(request.url);
		const search = url.searchParams.get('search')?.toLowerCase() ?? '';
		const username = url.searchParams.get('username');
		if (username) {
			const user = MOCK_USERS.find((u) => u.id === username) ?? MOCK_USERS[0];
			return HttpResponse.json(user);
		}
		if (!search) return HttpResponse.json([]);
		const results = MOCK_USERS.filter(
			(u) =>
				u.name.toLowerCase().includes(search) ||
				u.email.toLowerCase().includes(search) ||
				u.role.toLowerCase().includes(search)
		);
		return HttpResponse.json(results);
	})
];

// ─── Post handlers ────────────────────────────────────────────────────────────

export const postHandlers = (options: HandlerOptions = {}) => [
	http.get('http://localhost/posts', async ({ request }) => {
		if (options.delayMs) await delay(options.delayMs);
		if (options.error) return new HttpResponse(null, { status: 500 });
		const url = new URL(request.url);
		const page = Number(url.searchParams.get('page') ?? 1);
		const limit = Number(url.searchParams.get('limit') ?? 5);
		const category = url.searchParams.get('category');
		const filtered = category ? MOCK_POSTS.filter((p) => p.category === category) : MOCK_POSTS;
		const start = (page - 1) * limit;
		return HttpResponse.json({
			data: filtered.slice(start, start + limit),
			meta: {
				total: filtered.length,
				page,
				perPage: limit,
				totalPages: Math.ceil(filtered.length / limit)
			}
		});
	}),
	http.post('http://localhost/posts', async ({ request }) => {
		if (options.delayMs) await delay(options.delayMs);
		if (options.error) return new HttpResponse(null, { status: 500 });
		const body = (await request.json()) as { title: string; content: string; category: string };
		return HttpResponse.json(
			{
				id: `post-new-${Date.now()}`,
				title: body.title,
				content: body.content,
				excerpt: body.content.slice(0, 80),
				category: body.category,
				author: 'Alice Johnson',
				publishedAt: new Date().toISOString()
			},
			{ status: 201 }
		);
	})
];

// ─── Department handlers ──────────────────────────────────────────────────────

export const departmentHandlers = (options: HandlerOptions = {}) => [
	http.get('http://localhost/user/:id/departments', async () => {
		if (options.delayMs) await delay(options.delayMs);
		if (options.error) return new HttpResponse(null, { status: 500 });
		return HttpResponse.json(MOCK_DEPARTMENTS);
	})
];
