<script lang="ts">
	import { resolve } from '$app/paths';

	let { data, form } = $props();
</script>

<section class="panel">
	<p class="eyebrow">Offers</p>
	<h1 class="hero-title">Driver offers and live jobs</h1>
	{#if form?.error}
		<div class="notice">{form.error}</div>
	{/if}
</section>

<section class="grid two">
	<div class="panel">
		<p class="eyebrow">Pending offers</p>
		<div class="grid">
			{#if data.offers.filter((offer) => offer.status === 'pending').length === 0}
				<p class="muted">No pending offers right now.</p>
			{:else}
				{#each data.offers.filter((offer) => offer.status === 'pending') as offer (offer.id)}
					<div class="metric">
						<strong>Order {offer.orderId.slice(0, 8)}</strong>
						<span>{offer.vehicleName}</span>
						<span>
							{offer.packageLengthCm}x{offer.packageWidthCm}x{offer.packageHeightCm} cm · {offer.packageWeightKg}
							kg
						</span>
						<span class="muted">
							Pickup: {offer.locations.pickup
								? `${offer.locations.pickup.latitude.toFixed(4)}, ${offer.locations.pickup.longitude.toFixed(4)}`
								: 'Pending'}
						</span>
						<span class="muted">Expires: {new Date(offer.expiresAt).toLocaleTimeString()}</span>
						<div class="grid two">
							<form method="POST" action="?/accept">
								<input type="hidden" name="offerId" value={offer.id} />
								<button class="primary" type="submit">Accept</button>
							</form>
							<form method="POST" action="?/reject">
								<input type="hidden" name="offerId" value={offer.id} />
								<button class="secondary" type="submit">Decline</button>
							</form>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>

	<div class="panel table-card">
		<p class="eyebrow">Active jobs</p>
		<table>
			<thead>
				<tr>
					<th>Order</th>
					<th>Status</th>
					<th>Customer</th>
					<th>Route</th>
				</tr>
			</thead>
			<tbody>
				{#each data.activeJobs as job (job.id)}
					<tr>
						<td><a href={resolve('/driver/jobs/[id]', { id: job.id })}>{job.id.slice(0, 8)}</a></td>
						<td><span class="pill">{job.status}</span></td>
						<td>{job.customerJid}</td>
						<td>
							<div>
								Pickup: {job.locations.pickup
									? `${job.locations.pickup.latitude.toFixed(4)}, ${job.locations.pickup.longitude.toFixed(4)}`
									: 'Pending'}
							</div>
							<div class="muted">
								Dropoff: {job.locations.dropoff
									? `${job.locations.dropoff.latitude.toFixed(4)}, ${job.locations.dropoff.longitude.toFixed(4)}`
									: 'Pending'}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
