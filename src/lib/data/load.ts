import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type { GroupsData, LinkedItem, Supergroup } from '$lib/types';

const DATA_DIR = join(process.cwd(), 'data');

function unescapeMd(text: string): string {
	return text.replace(/\\(.)/g, '$1');
}

function isEmpty(cell: string): boolean {
	const c = cell.trim();
	return !c || c === '\\-' || c === '-';
}

function extractLinkedItems(cell: string): LinkedItem[] {
	if (isEmpty(cell)) return [];

	const items: LinkedItem[] = [];
	const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
	let match;
	while ((match = regex.exec(cell)) !== null) {
		items.push({
			name: unescapeMd(match[1]),
			url: match[2]
		});
	}
	return items;
}

function extractSingleLink(cell: string): { name: string; url?: string } {
	const cleaned = cell.trim();
	const match = cleaned.match(/\[([^\]]+)\]\(([^)]+)\)/);
	if (match) {
		return { name: unescapeMd(match[1]), url: match[2] };
	}
	return { name: unescapeMd(cleaned) };
}

function extractText(cell: string): string {
	return isEmpty(cell) ? '' : unescapeMd(cell.trim());
}

function extractGoals(cell: string): string {
	const text = extractText(cell);
	if (!text) return '';
	const goals = text.split(
		/(?<=\))\s+(?=[A-Z])|(?<=[a-z])\s+(?=[A-Z][a-z]+\s+(?:a|an|the|our|their|its|to|into|in|for|from|with)\b)/
	);
	return goals.join('. ').replace(/\.?\s*$/, '.');
}

function extractUrl(cell: string): string | undefined {
	if (isEmpty(cell)) return undefined;
	const match = cell.trim().match(/\[([^\]]*)\]\(([^)]+)\)/);
	return match ? match[2].replace(/\/+$/, '') : undefined;
}

function parseMdRow(line: string): string[] {
	return line
		.replace(/^\|/, '')
		.replace(/\|$/, '')
		.split('|')
		.map((s) => s.trim());
}

function parseCSVRow(row: string): string[] {
	const fields: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < row.length; i++) {
		const char = row[i];
		if (inQuotes) {
			if (char === '"') {
				if (i + 1 < row.length && row[i + 1] === '"') {
					current += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				current += char;
			}
		} else {
			if (char === '"') {
				inQuotes = true;
			} else if (char === ',') {
				fields.push(current);
				current = '';
			} else {
				current += char;
			}
		}
	}
	fields.push(current);
	return fields;
}

function col(row: Record<string, string>, ...names: string[]): string {
	for (const name of names) {
		const lower = name.toLowerCase();
		for (const key of Object.keys(row)) {
			if (key.toLowerCase() === lower) {
				return row[key];
			}
		}
	}
	return '';
}

function buildCsvLookup(
	path: string,
	keyCol: string,
	valueCol: string
): Record<string, string> {
	const map: Record<string, string> = {};
	if (!existsSync(path)) return map;

	const text = readFileSync(path, 'utf-8');
	const rows = text.split(/\r?\n/);
	if (rows.length < 2) return map;

	const headers = parseCSVRow(rows[0]);
	const keyIdx = headers.findIndex((h) => h.toLowerCase() === keyCol.toLowerCase());
	const valIdx = headers.findIndex((h) => h.toLowerCase() === valueCol.toLowerCase());
	if (keyIdx === -1 || valIdx === -1) return map;

	for (let i = 1; i < rows.length; i++) {
		if (!rows[i].trim()) continue;
		const values = parseCSVRow(rows[i]);
		const key = values[keyIdx] || '';
		const val = values[valIdx] || '';
		if (key && val) map[key] = val;
	}
	return map;
}

let cached: GroupsData | null = null;

export function loadGroupsData(): GroupsData {
	if (cached) {
		return cached;
	}

	const dataFiles = readdirSync(DATA_DIR);

	const mdFile = dataFiles.find((f) => f.endsWith('.md'));
	if (!mdFile) {
		cached = { supergroups: [] };
		return cached;
	}

	const mdText = readFileSync(join(DATA_DIR, mdFile), 'utf-8');
	const mdLines = mdText.split('\n').filter((l) => l.trim().startsWith('|'));
	if (mdLines.length < 3) {
		cached = { supergroups: [] };
		return cached;
	}

	const headerCells = parseMdRow(mdLines[0]);
	const headers = headerCells.map((c) => {
		const m = c.match(/\[([^\]]+)\]/);
		return m ? m[1] : c.trim();
	});

	const csvFile = dataFiles.find((f) => f.endsWith('.csv'));
	const visionMap = csvFile
		? buildCsvLookup(join(DATA_DIR, csvFile), 'name', 'vision')
		: {};

	const supergroups: Supergroup[] = [];

	for (let i = 2; i < mdLines.length; i++) {
		const cells = parseMdRow(mdLines[i]);
		const row: Record<string, string> = {};
		headers.forEach((h, idx) => {
			row[h] = cells[idx] || '';
		});

		const nameInfo = extractSingleLink(col(row, 'Name'));
		const orgInfo = extractSingleLink(col(row, 'Org'));

		supergroups.push({
			name: nameInfo.name,
			url: nameInfo.url,
			org: orgInfo.name,
			orgUrl: orgInfo.url,
			mission: extractText(col(row, 'Mission')),
			goals: extractGoals(col(row, 'Goals')),
			vision: visionMap[nameInfo.name] || '',
			aboutUrl: extractUrl(col(row, 'About Us URL', 'About URL', 'About')),
			groups: extractLinkedItems(col(row, 'Groups')),
			subgroups: extractLinkedItems(col(row, 'Subgroups')),
			teams: extractLinkedItems(col(row, 'Teams'))
		});
	}

	supergroups.sort((a, b) => a.name.localeCompare(b.name));

	cached = { supergroups };
	return cached;
}
