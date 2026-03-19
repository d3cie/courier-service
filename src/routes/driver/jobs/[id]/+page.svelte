<script lang="ts">
	let { data, form } = $props();
</script>

<section class="panel">
	<p class="eyebrow">Job</p>
	<h1 class="hero-title">Order {data.order.id.slice(0, 8)}</h1>
	{#if form?.error}
		<div class="notice">{form.error}</div>
	{/if}
</section>

<section class="grid two">
	<div class="panel">
		<p class="eyebrow">Package</p>
		<div class="metric">
			<strong>{data.order.vehicleName ?? 'Assigned vehicle'}</strong>
			<span
				>{data.order.packageLengthCm}x{data.order.packageWidthCm}x{data.order.packageHeightCm} cm</span
			>
			<span>{data.order.packageWeightKg} kg</span>
			<span class="pill">{data.order.status}</span>
		</div>
		{#if data.order.notes}
			<p class="muted">{data.order.notes}</p>
		{/if}
	</div>

	<div class="panel">
		<p class="eyebrow">Route</p>
		<div class="metric">
			<strong>Pickup</strong>
			<span
				>{data.locations.pickup
					? `${data.locations.pickup.latitude.toFixed(5)}, ${data.locations.pickup.longitude.toFixed(5)}`
					: 'Pending'}</span
			>
		</div>
		<div class="metric">
			<strong>Dropoff</strong>
			<span
				>{data.locations.dropoff
					? `${data.locations.dropoff.latitude.toFixed(5)}, ${data.locations.dropoff.longitude.toFixed(5)}`
					: 'Pending'}</span
			>
		</div>
	</div>
</section>

<section class="panel">
	<p class="eyebrow">Progress</p>
	{#if data.canAdvance}
		<form method="POST" action="?/progress">
			<input type="hidden" name="orderId" value={data.order.id} />
			<button class="primary" type="submit">Move to next stage</button>
		</form>
	{:else}
		<p class="muted">This job is already complete or cannot be advanced from its current state.</p>
	{/if}
</section>
