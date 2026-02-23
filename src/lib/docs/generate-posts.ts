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

export { generatePosts };
