<script lang="ts">
	let { onsubmit }: { onsubmit: (password: string) => Promise<boolean> } = $props();

	let password = $state('');
	let errorMsg = $state('');
	let loading = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!password.trim() || loading) return;

		loading = true;
		errorMsg = '';

		const ok = await onsubmit(password);
		if (!ok) {
			errorMsg = 'Wrong password. Try again.';
			loading = false;
		}
	}
</script>

<div class="overlay">
	<div class="modal">
		<div class="lock">&#128274;</div>
		<h2>Canva Groups</h2>
		<p>Enter password to view the list</p>

		<form onsubmit={handleSubmit}>
			<input
				type="password"
				bind:value={password}
				placeholder="Password"
				autocomplete="off"
				disabled={loading}
			/>

			{#if errorMsg}
				<div class="error">{errorMsg}</div>
			{/if}

			<button type="submit" disabled={loading || !password.trim()}>
				{loading ? 'Checking...' : 'Enter'}
			</button>
		</form>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(248, 247, 252, 0.6);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}

	.modal {
		background: var(--color-surface);
		border-radius: var(--radius);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.12),
			0 2px 8px rgba(0, 0, 0, 0.06);
		padding: 40px;
		width: 100%;
		max-width: 380px;
		text-align: center;
	}

	.lock {
		font-size: 2.5rem;
		margin-bottom: 12px;
	}

	h2 {
		font-size: 1.4rem;
		font-weight: 800;
		background: linear-gradient(135deg, #7b2ff7 0%, #00b8a9 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		margin-bottom: 4px;
	}

	p {
		color: var(--color-text-secondary);
		font-size: 0.9rem;
		margin-bottom: 24px;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	input {
		width: 100%;
		padding: 10px 14px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 0.95rem;
		font-family: var(--font-sans);
		outline: none;
		transition: border-color 0.15s;
	}

	input:focus {
		border-color: var(--color-purple-400);
		box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
	}

	input:disabled {
		opacity: 0.6;
	}

	.error {
		color: #dc2626;
		font-size: 0.85rem;
		text-align: left;
	}

	button {
		padding: 10px 20px;
		background: linear-gradient(135deg, #7b2ff7 0%, #6d28d9 100%);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		font-size: 0.95rem;
		font-weight: 600;
		font-family: var(--font-sans);
		cursor: pointer;
		transition: opacity 0.15s;
	}

	button:hover:not(:disabled) {
		opacity: 0.9;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
