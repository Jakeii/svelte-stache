import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// We'd normally import from a shared data module
// For demo purposes, recreating a small subset
const posts = [
	{
		id: 'post-1',
		title: 'Post Title 1: The Future of Web Development',
		excerpt: 'This is a brief excerpt for post 1. It provides a summary of the content...',
		content:
			'Full content for post 1. This would typically be a longer piece of text with multiple paragraphs discussing the future of web development, emerging technologies, and best practices.',
		author: 'Alice Johnson',
		authorId: 'user-1',
		category: 'Technology',
		tags: ['web', 'development'],
		publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
		readTime: 5,
		likes: 42
	},
	{
		id: 'post-2',
		title: 'Post Title 2: Understanding State Management',
		excerpt: 'This is a brief excerpt for post 2. It provides a summary of the content...',
		content:
			'Full content for post 2. A deep dive into state management patterns, comparing different approaches and when to use each one in your applications.',
		author: 'Bob Smith',
		authorId: 'user-2',
		category: 'Design',
		tags: ['state', 'patterns'],
		publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
		readTime: 8,
		likes: 31
	}
];

export const GET: RequestHandler = async ({ params }) => {
	// Simulate network delay
	await new Promise((resolve) => setTimeout(resolve, 300));

	const post = posts.find((p) => p.id === params.id);

	if (!post) {
		error(404, { message: 'Post not found' });
	}

	return json(post);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	// Simulate network delay
	await new Promise((resolve) => setTimeout(resolve, 500));

	const postIndex = posts.findIndex((p) => p.id === params.id);

	if (postIndex === -1) {
		error(404, { message: 'Post not found' });
	}

	const data = await request.json();
	const updatedPost = { ...posts[postIndex], ...data };
	posts[postIndex] = updatedPost;

	return json(updatedPost);
};

export const DELETE: RequestHandler = async ({ params }) => {
	// Simulate network delay
	await new Promise((resolve) => setTimeout(resolve, 300));

	const postIndex = posts.findIndex((p) => p.id === params.id);

	if (postIndex === -1) {
		error(404, { message: 'Post not found' });
	}

	posts.splice(postIndex, 1);

	return new Response(null, { status: 204 });
};
