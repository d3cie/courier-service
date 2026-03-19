<script lang="ts">
	let { form } = $props();
</script>

<section class="panel login-shell">
	<p class="eyebrow">Sign In</p>
	<h1 class="hero-title">Run dispatch, drivers, and WhatsApp from one place.</h1>
	<p class="muted intro">
		This MVP seeds a dispatch admin and three demo drivers automatically on first run.
	</p>

	<div class="grid two">
		<form class="stack" method="POST">
			{#if form?.error}
				<div class="notice">{form.error}</div>
			{/if}

			<label class="field">
				<span>Email</span>
				<input
					name="email"
					type="email"
					value={form?.email ?? ''}
					placeholder="admin@example.com"
				/>
			</label>

			<label class="field">
				<span>Password</span>
				<input name="password" type="password" placeholder="••••••••" />
			</label>

			<button class="primary" type="submit">Sign in</button>
		</form>

		<div class="credentials">
			<div class="metric">
				<span class="eyebrow">Admin</span>
				<strong>admin@example.com</strong>
				<span>admin1234</span>
			</div>

			<div class="metric">
				<span class="eyebrow">Drivers</span>
				<strong>driver1@example.com</strong>
				<span>driver1234</span>
			</div>

			<p class="muted">
				Driver two and driver three use the same password. Change these credentials before a real
				deployment.
			</p>
		</div>
	</div>
</section>

<style>
	.login-shell {
		max-width: 960px;
		margin: 6vh auto 0;
	}

	.intro {
		max-width: 40rem;
	}

	.credentials {
		display: grid;
		gap: 1rem;
		align-content: start;
	}
</style>
