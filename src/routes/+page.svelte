<script lang="ts">
	import { slide } from 'svelte/transition';
	import type { Supergroup } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let expanded: Record<string, boolean> = $state({});
	let autoExpandDismissed: Record<string, boolean> = $state({});

	function charFuzzyScore(query: string, text: string): number {
		let qi = 0;
		let score = 0;
		let consecutive = 0;

		for (let ti = 0; ti < text.length && qi < query.length; ti++) {
			if (text[ti] === query[qi]) {
				qi++;
				consecutive++;
				score += consecutive;
				if (ti === 0 || /[\s\-_,&()]/.test(text[ti - 1])) score += 5;
			} else {
				consecutive = 0;
			}
		}

		return qi === query.length ? score : 0;
	}

	function fuzzyScore(query: string, text: string): number {
		const q = query.toLowerCase();
		const t = text.toLowerCase();

		if (t.includes(q)) return 1000 + q.length;

		const words = q.split(/\s+/).filter(Boolean);
		let total = 0;
		for (const word of words) {
			const s = charFuzzyScore(word, t);
			if (s === 0) return 0;
			total += s;
		}
		return total;
	}

	function searchableText(sg: Supergroup): string {
		return [
			sg.name,
			sg.org,
			sg.mission,
			sg.vision,
			sg.goals,
			...sg.groups.map((g) => g.name),
			...sg.subgroups.map((s) => s.name),
			...sg.teams.map((t) => t.name)
		].join(' ');
	}

	function childItemNames(sg: Supergroup): string[] {
		return [...sg.groups, ...sg.subgroups, ...sg.teams].map((item) => item.name);
	}

	let searchResults = $derived.by(() => {
		const q = searchQuery.trim();
		if (!q) return { list: data.supergroups, autoExpand: new Set<string>() };

		const scored = data.supergroups
			.map((sg) => ({ sg, score: fuzzyScore(q, searchableText(sg)) }))
			.filter((x) => x.score > 0)
			.sort((a, b) => b.score - a.score);

		const autoExpand = new Set<string>();
		for (const { sg } of scored) {
			if (childItemNames(sg).some((name) => fuzzyScore(q, name) > 0)) {
				autoExpand.add(sg.name);
			}
		}

		return { list: scored.map((x) => x.sg), autoExpand };
	});

	let filtered = $derived(searchResults.list);
	let searchAutoExpanded = $derived(searchResults.autoExpand);

	// Clean up dismissals for items no longer auto-expanded
	$effect(() => {
		const current = searchAutoExpanded;
		for (const name of Object.keys(autoExpandDismissed)) {
			if (!current.has(name)) {
				delete autoExpandDismissed[name];
			}
		}
	});

	function isExpanded(name: string): boolean {
		if (expanded[name]) return true;
		if (searchAutoExpanded.has(name) && !autoExpandDismissed[name]) return true;
		return false;
	}

	function toggle(name: string) {
		if (isExpanded(name)) {
			if (expanded[name]) {
				expanded[name] = false;
			}
			if (searchAutoExpanded.has(name)) {
				autoExpandDismissed[name] = true;
			}
		} else {
			expanded[name] = true;
			delete autoExpandDismissed[name];
		}
	}

	let allExpanded = $derived(filtered.every((sg) => isExpanded(sg.name)));
	let allCollapsed = $derived(filtered.every((sg) => !isExpanded(sg.name)));

	function expandAll() {
		for (const sg of filtered) {
			expanded[sg.name] = true;
		}
	}

	function collapseAll() {
		for (const sg of filtered) {
			expanded[sg.name] = false;
			if (searchAutoExpanded.has(sg.name)) {
				autoExpandDismissed[sg.name] = true;
			}
		}
	}

	function escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function getFuzzyMatchIndices(word: string, text: string): number[] {
		const w = word.toLowerCase();
		const t = text.toLowerCase();

		// Prefer substring match (contiguous)
		const subIdx = t.indexOf(w);
		if (subIdx !== -1) {
			return Array.from({ length: w.length }, (_, i) => subIdx + i);
		}

		// Fuzzy character match
		const indices: number[] = [];
		let wi = 0;
		for (let ti = 0; ti < t.length && wi < w.length; ti++) {
			if (t[ti] === w[wi]) {
				indices.push(ti);
				wi++;
			}
		}
		return wi === w.length ? indices : [];
	}

	function highlight(text: string): string {
		const q = searchQuery.trim();
		if (!q) return escapeHtml(text);

		const words = q.toLowerCase().split(/\s+/).filter(Boolean);
		const matched = new Set<number>();

		for (const word of words) {
			for (const idx of getFuzzyMatchIndices(word, text)) {
				matched.add(idx);
			}
		}

		if (matched.size === 0) return escapeHtml(text);

		let result = '';
		let inMark = false;
		for (let i = 0; i < text.length; i++) {
			if (matched.has(i) && !inMark) {
				result += '<mark>';
				inMark = true;
			} else if (!matched.has(i) && inMark) {
				result += '</mark>';
				inMark = false;
			}
			result += escapeHtml(text[i]);
		}
		if (inMark) result += '</mark>';
		return result;
	}
</script>

<svelte:head>
	<title>Canva Groups</title>
</svelte:head>

<div class="container">
	<header>
		<div class="header-row">
			<h1>Canva Groups</h1>
			<div class="header-actions">
				<button class="action-btn" onclick={expandAll} disabled={allExpanded}>Expand All</button>
				<button class="action-btn" onclick={collapseAll} disabled={allCollapsed}
					>Collapse All</button
				>
			</div>
		</div>
		<div class="search-wrapper">
			<input
				type="search"
				placeholder="Search groups, teams, missions..."
				bind:value={searchQuery}
				class="search-bar"
			/>
			{#if searchQuery.trim()}
				<p class="result-count">
					Showing {filtered.length} of {data.supergroups.length} supergroups
				</p>
			{/if}
		</div>
	</header>

	<ul class="supergroups">
		{#each filtered as sg (sg.name)}
			<li class="supergroup" class:is-expanded={isExpanded(sg.name)}>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="sg-header"
					onclick={() => toggle(sg.name)}
					onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle(sg.name)}
					role="button"
					tabindex="0"
				>
					<span class="chevron"></span>
					<span class="sg-title">
						{#if sg.url}
							<a
								href={sg.url}
								target="_blank"
								rel="noopener noreferrer"
								onclick={(e) => e.stopPropagation()}>{@html highlight(sg.name)}</a
							>
						{:else}
							{@html highlight(sg.name)}
						{/if}
						<span class="sg-org">({@html highlight(sg.org)})</span>
					</span>
				</div>

				{#if sg.mission || sg.vision || sg.goals || sg.aboutUrl}
					<div class="sg-meta">
						{#if sg.mission}
							<p class="meta-item">
								<span class="meta-label">Mission</span>
								<span class="meta-text">{@html highlight(sg.mission)}</span>
							</p>
						{/if}
						{#if sg.vision}
							<p class="meta-item">
								<span class="meta-label">Vision</span>
								<span class="meta-text">{@html highlight(sg.vision)}</span>
							</p>
						{/if}
						{#if sg.goals}
							<p class="meta-item">
								<span class="meta-label">Goals</span>
								<span class="meta-text">{@html highlight(sg.goals)}</span>
							</p>
						{/if}
						{#if sg.aboutUrl}
							<p class="meta-item">
								<span class="meta-label">About</span>
								<span class="meta-text"
									><a href={sg.aboutUrl} target="_blank" rel="noopener noreferrer">{sg.aboutUrl}</a
									></span
								>
							</p>
						{/if}
					</div>
				{/if}

				{#if isExpanded(sg.name)}
					<div class="sg-details" transition:slide={{ duration: 200 }}>
						<div class="details-grid">
							<div class="column">
								<h3>Groups</h3>
								{#if sg.groups.length > 0}
									<ul>
										{#each sg.groups as group}
											<li>
												{#if group.url}
													<a href={group.url} target="_blank" rel="noopener noreferrer"
														>{@html highlight(group.name)}</a
													>
												{:else}
													{@html highlight(group.name)}
												{/if}
											</li>
										{/each}
									</ul>
								{:else}
									<p class="empty">None</p>
								{/if}
							</div>
							<div class="column">
								<h3>Subgroups</h3>
								{#if sg.subgroups.length > 0}
									<ul>
										{#each sg.subgroups as subgroup}
											<li>
												{#if subgroup.url}
													<a href={subgroup.url} target="_blank" rel="noopener noreferrer"
														>{@html highlight(subgroup.name)}</a
													>
												{:else}
													{@html highlight(subgroup.name)}
												{/if}
											</li>
										{/each}
									</ul>
								{:else}
									<p class="empty">None</p>
								{/if}
							</div>
						</div>

						{#if sg.teams.length > 0}
							<div class="teams-section">
								<h3>Teams</h3>
								<p class="teams-list">
									{#each sg.teams as team, i}{#if team.url}<a
												href={team.url}
												target="_blank"
												rel="noopener noreferrer">{@html highlight(team.name)}</a
											>{:else}{@html highlight(team.name)}{/if}{#if i < sg.teams.length - 1}<span
												class="comma">,&nbsp;</span
											>{/if}{/each}
								</p>
							</div>
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ul>

	{#if filtered.length === 0 && searchQuery.trim()}
		<p class="no-results">No Supergroups match your search.</p>
	{/if}
</div>

<style>
	:global(mark) {
		background: #fef08a;
		color: inherit;
		border-radius: 2px;
		padding: 0;
	}

	:global(html) {
		scrollbar-gutter: stable;
	}

	:global(body) {
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', sans-serif;
		background: #f0f2f5;
		color: #111827;
		line-height: 1.6;
		margin: 0;
		padding: 0;
	}

	.container {
		max-width: 960px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
	}

	header {
		margin-bottom: 1.5rem;
	}

	.header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
		gap: 1rem;
	}

	h1 {
		font-size: 1.75rem;
		font-weight: 700;
		margin: 0;
		color: #111827;
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.action-btn {
		padding: 0.375rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		background: white;
		color: #374151;
		font-size: 0.8rem;
		font-family: inherit;
		cursor: pointer;
		transition:
			background 0.15s,
			border-color 0.15s,
			opacity 0.15s;
	}

	.action-btn:hover:not(:disabled) {
		background: #f3f4f6;
		border-color: #9ca3af;
	}

	.action-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.search-bar {
		width: 100%;
		padding: 0.75rem 1rem;
		border: 2px solid #e5e7eb;
		border-radius: 12px;
		font-size: 1rem;
		font-family: inherit;
		background: white;
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
		box-sizing: border-box;
	}

	.search-bar::-webkit-search-cancel-button {
		cursor: pointer;
	}

	.search-bar:focus {
		outline: none;
		border-color: #6366f1;
		box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
	}

	.result-count {
		font-size: 0.8rem;
		color: #6b7280;
		margin: 0.5rem 0 0;
	}

	.supergroups {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.supergroup {
		background: white;
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
		margin-bottom: 0.625rem;
		overflow: hidden;
		transition: box-shadow 0.2s;
	}

	.supergroup:hover {
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.08),
			0 1px 3px rgba(0, 0, 0, 0.06);
	}

	.sg-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.875rem 1.25rem;
		cursor: pointer;
		font-size: 1.05rem;
		font-weight: 600;
		color: #111827;
		user-select: none;
	}

	.sg-header:hover {
		background: #f9fafb;
	}

	.chevron {
		flex-shrink: 0;
		width: 1.25rem;
		height: 1.25rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.2s;
	}

	.chevron::after {
		content: '';
		display: block;
		width: 0;
		height: 0;
		border-top: 5px solid transparent;
		border-bottom: 5px solid transparent;
		border-left: 7px solid #9ca3af;
	}

	.is-expanded .chevron {
		transform: rotate(90deg);
	}

	.sg-title {
		flex: 1;
	}

	.sg-title a {
		color: inherit;
		text-decoration: none;
	}

	.sg-title a:hover {
		text-decoration: underline;
		color: #6366f1;
	}

	.sg-org {
		color: #6b7280;
		font-weight: 400;
		font-size: 0.95rem;
		margin-left: 0.25rem;
	}

	.sg-meta {
		padding: 0 1.25rem 0.75rem;
		padding-left: 2.75rem;
	}

	.meta-item {
		display: flex;
		gap: 0.625rem;
		margin: 0 0 0.2rem;
		font-size: 0.825rem;
		line-height: 1.5;
	}

	.meta-label {
		flex-shrink: 0;
		font-weight: 600;
		color: #9ca3af;
		font-size: 0.675rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding-top: 0.15rem;
		min-width: 50px;
	}

	.meta-text {
		color: #6b7280;
	}

	.sg-details {
		border-top: 1px solid #e5e7eb;
		padding: 1.25rem;
		background: #fafbfc;
	}

	.details-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}

	.column h3,
	.teams-section h3 {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #9ca3af;
		margin: 0 0 0.625rem;
		font-weight: 600;
	}

	.column ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.column ul li {
		padding: 0.175rem 0;
		font-size: 0.875rem;
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.column ul li::before {
		content: '';
		display: inline-block;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #6366f1;
		opacity: 0.35;
		flex-shrink: 0;
		position: relative;
		top: -1px;
	}

	.column a,
	.teams-list a,
	.meta-text a {
		color: #6366f1;
		text-decoration: none;
	}

	.column a:hover,
	.teams-list a:hover,
	.meta-text a:hover {
		text-decoration: underline;
	}

	.teams-section {
		margin-top: 1.25rem;
		padding-top: 1.25rem;
		border-top: 1px solid #e5e7eb;
	}

	.teams-list {
		font-size: 0.875rem;
		line-height: 1.8;
		color: #374151;
		margin: 0;
	}

	.comma {
		color: #9ca3af;
	}

	.empty {
		color: #d1d5db;
		font-size: 0.85rem;
		font-style: italic;
		margin: 0;
	}

	.no-results {
		text-align: center;
		color: #9ca3af;
		font-size: 1.05rem;
		padding: 3rem 0;
	}

	@media (max-width: 640px) {
		.header-row {
			flex-direction: column;
			align-items: flex-start;
		}

		.details-grid {
			grid-template-columns: 1fr;
		}

		.container {
			padding: 1rem;
		}

		.sg-meta {
			padding-left: 1.25rem;
		}
	}
</style>
