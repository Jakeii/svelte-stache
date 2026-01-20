import { defineNavigation } from "@svecodocs/kit";
import ChalkboardTeacher from "phosphor-svelte/lib/ChalkboardTeacher";
import RocketLaunch from "phosphor-svelte/lib/RocketLaunch";
import { getAllDocs } from "./utils.js";

const allDocs = getAllDocs();

const api = allDocs
	.filter((doc) => doc.section === "API")
	.map((doc) => ({
		title: doc.title,
		href: `/docs/${doc.slug}`,
	}));

const examples = allDocs
	.filter((doc) => doc.section === "Examples")
	.map((doc) => ({
		title: doc.title,
		href: `/docs/${doc.slug}`,
	}));

const guides = allDocs
	.filter((doc) => doc.section === "Guides")
	.map((doc) => ({
		title: doc.title,
		href: `/docs/${doc.slug}`,
	}));

export const navigation = defineNavigation({
	anchors: [
		{
			title: "Introduction",
			href: "/docs",
			icon: ChalkboardTeacher,
		},
		{
			title: "Getting Started",
			href: "/docs/getting-started",
			icon: RocketLaunch,
		},
	],
	sections: [
		{
			title: "API Reference",
			items: api,
		},
		{
			title: "Examples",
			items: examples,
		},
		{
			title: "Guides",
			items: guides,
		},
	],
});
