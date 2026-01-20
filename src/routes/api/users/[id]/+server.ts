import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

// Mock user data - same as parent route
const users = [
	{
		id: "user-1",
		name: "Alice Johnson",
		email: "alice@example.com",
		role: "Admin",
		avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alice",
		createdAt: "2024-01-15T10:30:00Z",
		bio: "Leading the team with passion and expertise.",
		department: "Engineering",
		location: "San Francisco, CA",
	},
	{
		id: "user-2",
		name: "Bob Smith",
		email: "bob@example.com",
		role: "Developer",
		avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=bob",
		createdAt: "2024-02-20T14:45:00Z",
		bio: "Full-stack developer specializing in TypeScript.",
		department: "Engineering",
		location: "New York, NY",
	},
	{
		id: "user-3",
		name: "Carol Williams",
		email: "carol@example.com",
		role: "Designer",
		avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=carol",
		createdAt: "2024-03-10T09:15:00Z",
		bio: "Creating beautiful and functional user experiences.",
		department: "Design",
		location: "Austin, TX",
	},
	{
		id: "user-4",
		name: "David Brown",
		email: "david@example.com",
		role: "Developer",
		avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=david",
		createdAt: "2024-04-05T16:20:00Z",
		bio: "Backend wizard with a love for optimization.",
		department: "Engineering",
		location: "Seattle, WA",
	},
	{
		id: "user-5",
		name: "Eva Martinez",
		email: "eva@example.com",
		role: "Product Manager",
		avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=eva",
		createdAt: "2024-05-12T11:00:00Z",
		bio: "Bridging the gap between users and technology.",
		department: "Product",
		location: "Los Angeles, CA",
	},
];

export const GET: RequestHandler = async ({ params }) => {
	// Simulate network delay
	await new Promise((resolve) => setTimeout(resolve, 400));

	const user = users.find((u) => u.id === params.id);

	if (!user) {
		error(404, { message: "User not found" });
	}

	return json(user);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	// Simulate network delay
	await new Promise((resolve) => setTimeout(resolve, 500));

	const userIndex = users.findIndex((u) => u.id === params.id);

	if (userIndex === -1) {
		error(404, { message: "User not found" });
	}

	const data = await request.json();
	const updatedUser = { ...users[userIndex], ...data };
	users[userIndex] = updatedUser;

	return json(updatedUser);
};

export const DELETE: RequestHandler = async ({ params }) => {
	// Simulate network delay
	await new Promise((resolve) => setTimeout(resolve, 300));

	const userIndex = users.findIndex((u) => u.id === params.id);

	if (userIndex === -1) {
		error(404, { message: "User not found" });
	}

	users.splice(userIndex, 1);

	return new Response(null, { status: 204 });
};
