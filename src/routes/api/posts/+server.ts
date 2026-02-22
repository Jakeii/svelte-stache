import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Generate mock posts
const generatePosts = (count: number) => {
	const categories = ['Technology', 'Design', 'Business', 'Lifestyle', 'Science'];
	const authors = ['Alice Johnson', 'Bob Smith', 'Carol Williams', 'David Brown', 'Eva Martinez'];

	return Array.from({ length: count }, (_, i) => ({
		id: `post-${i + 1}`,
		title: `Post Title ${i + 1}: ${getRandomTitle(i)}`,
		excerpt: `This is a brief excerpt for post ${i + 1}. It provides a summary of the content...`,
		content: `Full content for post ${i + 1}. This would typically be a longer piece of text with multiple paragraphs, images, and other media. The content discusses various topics related to ${categories[i % categories.length].toLowerCase()}.`,
		author: authors[i % authors.length],
		authorId: `user-${(i % 5) + 1}`,
		category: categories[i % categories.length],
		tags: [`tag-${(i % 3) + 1}`, `tag-${(i % 5) + 4}`],
		publishedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
		readTime: Math.floor(Math.random() * 10) + 3,
		likes: Math.floor(Math.random() * 100)
	}));
};

const getRandomTitle = (seed: number): string => {
	const titles = [
		'The Future of Web Development',
		'Understanding State Management',
		'Building Better User Experiences',
		'Modern JavaScript Patterns',
		'Design Systems That Scale',
		'Performance Optimization Tips',
		'Accessibility Best Practices',
		'The Art of Clean Code',
		'Responsive Design Strategies',
		'Testing Your Applications',
		'DevOps for Frontend Developers',
		'The Rise of Edge Computing',
		'Machine Learning Basics',
		'Working with APIs',
		'Component Architecture'
	];
	return titles[seed % titles.length];
};

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
