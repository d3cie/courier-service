<script lang="ts">
	let { data } = $props();
</script>

<section class="panel">
	<p class="eyebrow">Operations</p>
	<h1 class="hero-title">Dispatch board</h1>
	<p class="muted">
		Every WhatsApp request lands here once it starts moving through confirmation and assignment.
	</p>
</section>

<section class="panel table-card">
	<table>
		<thead>
			<tr>
				<th>Order</th>
				<th>Status</th>
				<th>Package</th>
				<th>Route</th>
				<th>Assignment</th>
				<th>Created</th>
			</tr>
		</thead>
		<tbody>
			{#each data.orders as order (order.id)}
				<tr>
					<td>
						<strong>{order.id.slice(0, 8)}</strong>
						<div class="muted">{order.customerJid}</div>
					</td>
					<td><span class="pill">{order.status}</span></td>
					<td>
						<div>{order.presetLabel ?? 'Draft'}</div>
						<div class="muted">
							{order.packageLengthCm ?? '?'}x{order.packageWidthCm ?? '?'}x{order.packageHeightCm ??
								'?'} cm,
							{order.packageWeightKg ?? '?'} kg
						</div>
						{#if order.notes}
							<div class="muted">{order.notes}</div>
						{/if}
					</td>
					<td>
						<div>
							Pickup: {order.locations.pickup
								? `${order.locations.pickup.latitude.toFixed(4)}, ${order.locations.pickup.longitude.toFixed(4)}`
								: 'Pending'}
						</div>
						<div class="muted">
							Dropoff: {order.locations.dropoff
								? `${order.locations.dropoff.latitude.toFixed(4)}, ${order.locations.dropoff.longitude.toFixed(4)}`
								: 'Pending'}
						</div>
					</td>
					<td>
						<div>{order.driverName ?? 'Unassigned'}</div>
						<div class="muted">{order.vehicleName ?? 'Awaiting match'}</div>
					</td>
					<td>{new Date(order.createdAt).toLocaleString()}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>
