import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { docs } from '../.velite/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const SECTION_ORDER = ['Overview', 'Guides', 'API', 'Examples'];

function docHref(doc) {
	return doc.slug === 'index' ? '/docs' : `/docs/${doc.slug}`;
}

function groupBySection(allDocs) {
	const bySection = new Map(SECTION_ORDER.map((section) => [section, []]));
	for (const doc of allDocs) {
		bySection.get(doc.section)?.push(doc);
	}
	return bySection;
}

function buildLlmsTxt(allDocs) {
	const index = allDocs.find((doc) => doc.slug === 'index');
	const bySection = groupBySection(allDocs);

	const lines = ['# Stache', '', `> ${index?.description ?? ''}`, ''];

	for (const section of SECTION_ORDER) {
		const sectionDocs = (bySection.get(section) ?? []).filter((doc) => doc !== index);
		if (sectionDocs.length === 0) continue;

		lines.push(`## ${section}`, '');
		for (const doc of sectionDocs) {
			lines.push(`- [${doc.title}](${docHref(doc)}): ${doc.description}`);
		}
		lines.push('');
	}

	return lines.join('\n').trimEnd() + '\n';
}

function buildLlmsFullTxt(allDocs) {
	const index = allDocs.find((doc) => doc.slug === 'index');
	const bySection = groupBySection(allDocs);

	const lines = ['# Stache', '', `> ${index?.description ?? ''}`, ''];

	for (const section of SECTION_ORDER) {
		const sectionDocs = bySection.get(section) ?? [];
		if (sectionDocs.length === 0) continue;

		for (const doc of sectionDocs) {
			lines.push(
				`## ${doc.title}`,
				'',
				`Source: ${docHref(doc)}`,
				'',
				doc.raw.trim(),
				'',
				'---',
				''
			);
		}
	}

	lines.pop();

	return lines.join('\n').trimEnd() + '\n';
}

const sortedDocs = [...docs].sort((a, b) => {
	if (a.slug === 'index') return -1;
	if (b.slug === 'index') return 1;
	return SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section);
});

writeFileSync(resolve(__dirname, '../static/llms.txt'), buildLlmsTxt(sortedDocs), { flag: 'w' });
writeFileSync(resolve(__dirname, '../static/llms-full.txt'), buildLlmsFullTxt(sortedDocs), {
	flag: 'w'
});
