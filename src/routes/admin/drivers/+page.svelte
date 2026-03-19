<script lang="ts">
	let { data, form } = $props();
</script>

<section class="grid two">
	<div class="panel">
		<p class="eyebrow">Team</p>
		<h1 class="hero-title">Driver roster</h1>
		<p class="muted">
			Drivers manage their own vehicles in the portal, while dispatch can add new accounts here.
		</p>
	</div>

	<form class="panel stack" method="POST" action="?/createDriver">
		<p class="eyebrow">Add Driver</p>
		{#if form?.error}
			<div class="notice">{form.error}</div>
		{/if}

		<label class="field">
			<span>Name</span>
			<input name="name" placeholder="Full name" />
		</label>

		<label class="field">
			<span>Email</span>
			<input name="email" type="email" placeholder="driver@example.com" />
		</label>

		<label class="field">
			<span>Phone</span>
			<input name="phone" placeholder="+263..." />
		</label>

		<label class="field">
			<span>Password</span>
			<input name="password" type="password" placeholder="Minimum 8 characters" />
		</label>

		<button class="primary" type="submit">Create driver</button>
	</form>
</section>

<section class="panel table-card">
	<table>
		<thead>
			<tr>
				<th>Driver</th>
				<th>Status</th>
				<th>Location</th>
				<th>Vehicles</th>
			</tr>
		</thead>
		<tbody>
			{#each data.drivers as driver (driver.driverId)}
				<tr>
					<td>
						<strong>{driver.displayName}</strong>
						<div class="muted">{driver.email}</div>
						<div class="muted">{driver.phone ?? 'No phone'}</div>
					</td>
					<td>
						<div class="pill">{driver.availabilityStatus ?? 'offline'}</div>
						<div class="muted">{driver.isOnline ? 'Online' : 'Offline'}</div>
					</td>
					<td>
						{#if driver.currentLatitude && driver.currentLongitude}
							{driver.currentLatitude.toFixed(4)}, {driver.currentLongitude.toFixed(4)}
						{:else}
							<span class="muted">No live pin</span>
						{/if}
					</td>
					<td>
						{#if driver.vehicles.length === 0}
							<span class="muted">No vehicles yet</span>
						{:else}
							{#each driver.vehicles as vehicle (vehicle.id)}
								<div>{vehicle.name} {vehicle.isActive ? '(active)' : ''}</div>
								<div class="muted">
									{vehicle.templateKey} · {vehicle.maxLengthCm}x{vehicle.maxWidthCm}x{vehicle.maxHeightCm}
									cm · {vehicle.maxWeightKg} kg
								</div>
							{/each}
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>
