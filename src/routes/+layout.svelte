<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { data, children } = $props();

	const adminHome = '/admin/orders' as const;
	const driverHome = '/driver/offers' as const;

	const adminLinks = [
		{ href: '/admin/orders', label: 'Orders' },
		{ href: '/admin/drivers', label: 'Drivers' },
		{ href: '/admin/integrations/whatsapp', label: 'WhatsApp' }
	] as const;

	const driverLinks = [
		{ href: '/driver/offers', label: 'Offers' },
		{ href: '/driver/availability', label: 'Availability' }
	] as const;
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Courier Service</title>
	<meta name="description" content="Courier dispatch dashboard and WhatsApp worker portal." />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;700&family=Space+Grotesk:wght@400;500;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="frame">
	<div class="halo halo-left"></div>
	<div class="halo halo-right"></div>

	<div class="shell">
		<header class="topbar">
			<a class="brand" href={resolve(data.user?.role === 'driver' ? driverHome : adminHome)}>
				<span class="brand-mark">C</span>
				<div>
					<strong>Courier Service</strong>
					<small>Dispatch + WhatsApp automation</small>
				</div>
			</a>

			{#if data.user}
				<nav class="topnav">
					{#each data.user.role === 'admin' ? adminLinks : driverLinks as link (link.href)}
						<a class:active={page.url.pathname.startsWith(link.href)} href={resolve(link.href)}
							>{link.label}</a
						>
					{/each}
				</nav>

				<div class="session">
					<div>
						<strong>{data.user.name}</strong>
						<small>{data.user.role}</small>
					</div>
					<form method="POST" action="/logout">
						<button type="submit">Log out</button>
					</form>
				</div>
			{/if}
		</header>

		<main class="content">
			{@render children()}
		</main>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		min-height: 100vh;
		background:
			radial-gradient(circle at top left, rgba(255, 138, 61, 0.25), transparent 30%),
			radial-gradient(circle at bottom right, rgba(10, 111, 117, 0.28), transparent 35%),
			linear-gradient(160deg, #f5e8d5 0%, #efe6dc 35%, #dde8e4 100%);
		color: #142123;
		font-family: 'Space Grotesk', 'Avenir Next', sans-serif;
	}

	:global(*) {
		box-sizing: border-box;
	}

	:global(a) {
		color: inherit;
		text-decoration: none;
	}

	:global(button),
	:global(input),
	:global(select),
	:global(textarea) {
		font: inherit;
	}

	.frame {
		position: relative;
		min-height: 100vh;
		overflow: hidden;
	}

	.halo {
		position: absolute;
		width: 24rem;
		height: 24rem;
		border-radius: 999px;
		filter: blur(80px);
		opacity: 0.6;
	}

	.halo-left {
		top: -8rem;
		left: -10rem;
		background: rgba(255, 165, 104, 0.42);
	}

	.halo-right {
		right: -9rem;
		bottom: -10rem;
		background: rgba(39, 134, 138, 0.35);
	}

	.shell {
		position: relative;
		max-width: 1200px;
		margin: 0 auto;
		padding: 1.5rem;
	}

	.topbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.5rem;
		padding: 1rem 1.2rem;
		border: 1px solid rgba(20, 33, 35, 0.1);
		border-radius: 1.5rem;
		background: rgba(255, 252, 246, 0.78);
		backdrop-filter: blur(16px);
		box-shadow: 0 18px 40px rgba(47, 58, 60, 0.08);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}

	.brand strong {
		display: block;
		font-family: 'Fraunces', serif;
		font-size: 1.2rem;
	}

	.brand small,
	.session small {
		display: block;
		color: #557174;
	}

	.brand-mark {
		display: grid;
		place-items: center;
		width: 2.8rem;
		height: 2.8rem;
		border-radius: 1rem;
		background: linear-gradient(135deg, #f37c44, #0d6d72);
		color: white;
		font-family: 'Fraunces', serif;
		font-size: 1.45rem;
	}

	.topnav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.topnav a {
		padding: 0.6rem 0.9rem;
		border-radius: 999px;
		color: #4b6265;
	}

	.topnav a.active {
		background: #143b3d;
		color: #fff;
	}

	.session {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}

	.session button {
		padding: 0.7rem 1rem;
		border: 0;
		border-radius: 999px;
		background: #f37c44;
		color: #fff;
		cursor: pointer;
	}

	.content {
		display: grid;
		gap: 1.25rem;
	}

	:global(.panel) {
		padding: 1.25rem;
		border: 1px solid rgba(20, 33, 35, 0.1);
		border-radius: 1.5rem;
		background: rgba(255, 252, 246, 0.8);
		box-shadow: 0 18px 44px rgba(47, 58, 60, 0.08);
	}

	:global(.eyebrow) {
		margin: 0 0 0.55rem;
		text-transform: uppercase;
		letter-spacing: 0.16em;
		font-size: 0.78rem;
		color: #4d6c70;
	}

	:global(.hero-title) {
		margin: 0;
		font-family: 'Fraunces', serif;
		font-size: clamp(2rem, 3vw, 3.1rem);
		line-height: 1.02;
	}

	:global(.grid) {
		display: grid;
		gap: 1rem;
	}

	:global(.grid.two) {
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
	}

	:global(.grid.three) {
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	}

	:global(.pill) {
		display: inline-flex;
		align-items: center;
		padding: 0.35rem 0.75rem;
		border-radius: 999px;
		background: rgba(13, 109, 114, 0.12);
		color: #0d565a;
		font-size: 0.86rem;
	}

	:global(.table-card) {
		overflow: auto;
	}

	:global(table) {
		width: 100%;
		border-collapse: collapse;
	}

	:global(th),
	:global(td) {
		padding: 0.8rem;
		border-bottom: 1px solid rgba(20, 33, 35, 0.08);
		text-align: left;
		vertical-align: top;
	}

	:global(th) {
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: #577073;
	}

	:global(form.stack) {
		display: grid;
		gap: 0.85rem;
	}

	:global(label.field) {
		display: grid;
		gap: 0.35rem;
		font-size: 0.92rem;
		color: #3f5256;
	}

	:global(input),
	:global(select),
	:global(textarea) {
		padding: 0.8rem 0.9rem;
		border: 1px solid rgba(20, 33, 35, 0.14);
		border-radius: 0.95rem;
		background: rgba(255, 255, 255, 0.88);
	}

	:global(button.primary),
	:global(button.secondary) {
		padding: 0.8rem 1.05rem;
		border: 0;
		border-radius: 0.95rem;
		cursor: pointer;
	}

	:global(button.primary) {
		background: linear-gradient(135deg, #f37c44, #d8612f);
		color: white;
	}

	:global(button.secondary) {
		background: rgba(20, 59, 61, 0.09);
		color: #143b3d;
	}

	:global(.muted) {
		color: #5d7275;
	}

	:global(.notice) {
		padding: 0.85rem 1rem;
		border-radius: 1rem;
		background: rgba(243, 124, 68, 0.12);
		color: #7e4a2b;
	}

	:global(.cards) {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
		gap: 1rem;
	}

	:global(.metric) {
		display: grid;
		gap: 0.35rem;
		padding: 1rem;
		border-radius: 1.25rem;
		background: linear-gradient(155deg, rgba(255, 255, 255, 0.92), rgba(236, 246, 244, 0.9));
		border: 1px solid rgba(20, 33, 35, 0.08);
	}

	:global(.metric strong) {
		font-size: 1.4rem;
		font-family: 'Fraunces', serif;
	}

	@media (max-width: 700px) {
		.shell {
			padding: 1rem;
		}

		.topbar {
			align-items: flex-start;
		}

		.session {
			width: 100%;
			justify-content: space-between;
		}
	}
</style>
