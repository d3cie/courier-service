<script lang="ts">
	let { data } = $props();

	function describeStatus() {
		const status = data.connection?.status;
		const lastError = data.connection?.lastError;

		if (lastError) {
			return lastError;
		}

		switch (status) {
			case 'starting':
				return 'Worker is starting. If this takes more than a minute, restart it and make sure only one worker is running.';
			case 'qr_ready':
				return 'QR code ready. Scan it from WhatsApp on your phone under Linked Devices.';
			case 'ready':
				return 'Worker is connected and ready.';
			case 'disconnected':
				return 'Worker disconnected. Restart it if it does not reconnect on its own.';
			case 'error':
				return 'Worker reported an error. Check the worker terminal for details.';
			case 'stopped':
				return 'Worker is not running. Start `pnpm worker` in a separate terminal.';
			default:
				return 'Worker state has not been recorded yet.';
		}
	}
</script>

<svelte:head>
	<meta http-equiv="refresh" content="10" />
</svelte:head>

<section class="panel">
	<p class="eyebrow">Integration</p>
	<h1 class="hero-title">WhatsApp worker state</h1>
	<p class="muted">
		Run <code>pnpm worker</code> alongside the web app. This screen auto-refreshes every 10 seconds.
	</p>
</section>

<section class="cards">
	<div class="metric">
		<span class="eyebrow">Status</span>
		<strong>{data.connection?.status ?? 'unknown'}</strong>
		<span>{describeStatus()}</span>
	</div>
	<div class="metric">
		<span class="eyebrow">Last Ready</span>
		<strong
			>{data.connection?.lastReadyAt
				? new Date(data.connection.lastReadyAt).toLocaleString()
				: 'Never'}</strong
		>
		<span>Worker last reached ready state.</span>
	</div>
	<div class="metric">
		<span class="eyebrow">Last Sync</span>
		<strong
			>{data.connection?.lastSyncAt
				? new Date(data.connection.lastSyncAt).toLocaleString()
				: 'Never'}</strong
		>
		<span>Most recent provider heartbeat recorded.</span>
	</div>
</section>

<section class="grid two">
	<div class="panel">
		<p class="eyebrow">QR Pairing</p>
		{#if data.connection?.qrCode}
			<img class="qr" alt="WhatsApp QR" src={data.connection.qrCode} />
		{:else}
			<p class="muted">
				{#if data.connection?.status === 'starting'}
					Waiting for WhatsApp Web to finish starting before a QR can be shown.
				{:else if data.connection?.status === 'ready'}
					No QR is needed. This session is already authenticated.
				{:else if data.connection?.status === 'stopped'}
					Start the worker first. A QR will appear here when pairing is required.
				{:else}
					No QR is currently available.
				{/if}
			</p>
		{/if}
	</div>

	<div class="panel table-card">
		<p class="eyebrow">Outbound Queue</p>
		<table>
			<thead>
				<tr>
					<th>Status</th>
					<th>Recipient</th>
					<th>Kind</th>
					<th>Error</th>
				</tr>
			</thead>
			<tbody>
				{#each data.recentOutbox as item (item.id)}
					<tr>
						<td><span class="pill">{item.status}</span></td>
						<td>{item.toJid}</td>
						<td>{item.kind}</td>
						<td>{item.lastError ?? 'None'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<section class="panel table-card">
	<p class="eyebrow">Recent Messages</p>
	<table>
		<thead>
			<tr>
				<th>When</th>
				<th>Direction</th>
				<th>Type</th>
				<th>JID</th>
				<th>Body</th>
			</tr>
		</thead>
		<tbody>
			{#each data.recentMessages as item (item.id)}
				<tr>
					<td>{new Date(item.createdAt).toLocaleString()}</td>
					<td>{item.direction}</td>
					<td>{item.messageType}</td>
					<td>{item.customerJid ?? 'n/a'}</td>
					<td>{item.body ?? 'Location / structured payload'}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<style>
	.qr {
		width: min(100%, 340px);
		padding: 1rem;
		border-radius: 1.5rem;
		background: white;
	}
</style>
