import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generatePosts } from '$lib/docs/generate-posts';

const allPosts = generatePosts(50);

export const GET: RequestHandler = async ({ url }) => {
	// Simulate network delay
	await new Promise((resolve) => setTimeout(resolve, 400));

	const page = parseInt(url.searchParams.get('page') ?? '0');
	const limit = parseInt(url.searchParams.get('limit') ?? '10');
	const category = url.searchParams.get('category');
	const search = url.searchParams.get('search')?.toLowerCase();

	let filtered = allPosts;

	if (category && category !== 'all') {
		filtered = filtered.filter((post) => post.category.toLowerCase() === category.toLowerCase());
	}

	if (search) {
		filtered = filtered.filter(
			(post) =>
				post.title.toLowerCase().includes(search) ||
				post.excerpt.toLowerCase().includes(search) ||
				post.author.toLowerCase().includes(search)
		);
	}

	const start = page * limit;
	const end = start + limit;
	const paginatedPosts = filtered.slice(start, end);

	return json({
		data: paginatedPosts,
		meta: {
			total: filtered.length,
			page,
			perPage: limit,
			totalPages: Math.ceil(filtered.length / limit)
		}
	});
};

export const POST: RequestHandler = async ({ request }) => {
	// Simulate network delay
	await new Promise((resolve) => setTimeout(resolve, 600));

	const data = await request.json();

	const newPost = {
		id: `post-${Date.now()}`,
		title: data.title,
		excerpt: data.excerpt || data.content?.slice(0, 150) + '...',
		content: data.content,
		author: data.author || 'Anonymous',
		authorId: data.authorId || 'user-1',
		category: data.category || 'General',
		tags: data.tags || [],
		publishedAt: new Date().toISOString(),
		readTime: Math.ceil((data.content?.length || 0) / 1000) + 1,
		likes: 0
	};

	// In a real app, save to database
	allPosts.unshift(newPost);

	return json(newPost, { status: 201 });
};
