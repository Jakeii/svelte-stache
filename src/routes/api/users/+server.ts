import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

// Mock user data
const users = [
	{
		id: "user-1",
		name: "Alice Johnson",
		email: "alice@example.com",
		role: "Admin",
		avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alice",
		createdAt: "2024-01-15T10:30:00Z",
	},
	{
		id: "user-2",
		name: "Bob Smith",
		email: "bob@example.com",
		role: "Developer",
		avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=bob",
		createdAt: "2024-02-20T14:45:00Z",
	},
	{
		id: "user-3",
		name: "Carol Williams",
		email: "carol@example.com",
		role: "Designer",
		avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=carol",
		createdAt: "2024-03-10T09:15:00Z",
	},
	{
		id: "user-4",
		name: "David Brown",
		email: "david@example.com",
		role: "Developer",
		avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=david",
		createdAt: "2024-04-05T16:20:00Z",
	},
	{
		id: "user-5",
		name: "Eva Martinez",
		email: "eva@example.com",
		role: "Product Manager",
		avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=eva",
		createdAt: "2024-05-12T11:00:00Z",
	},
];

export const GET: RequestHandler = async ({ url }) => {
	// Simulate network delay
	await new Promise((resolve) => setTimeout(resolve, 300));

	const search = url.searchParams.get("search")?.toLowerCase();

	let result = users;

	if (search) {
		result = users.filter(
			(user) =>
				user.name.toLowerCase().includes(search) ||
				user.email.toLowerCase().includes(search) ||
				user.role.toLowerCase().includes(search)
		);
	}

	return json(result);
};

export const POST: RequestHandler = async ({ request }) => {
	// Simulate network delay
	await new Promise((resolve) => setTimeout(resolve, 500));

	const data = await request.json();

	const newUser = {
		id: `user-${Date.now()}`,
		name: data.name,
		email: data.email,
		role: data.role || "User",
		avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.name}`,
		createdAt: new Date().toISOString(),
	};

	// In a real app, you'd save to a database
	users.push(newUser);

	return json(newUser, { status: 201 });
};
