<script lang="ts">
	let { data, form } = $props();

	let latitude = $state('');
	let longitude = $state('');

	$effect(() => {
		latitude = data.availability?.currentLatitude?.toString() ?? '';
		longitude = data.availability?.currentLongitude?.toString() ?? '';
	});

	async function useCurrentLocation() {
		if (!navigator.geolocation) {
			return;
		}

		navigator.geolocation.getCurrentPosition((position) => {
			latitude = position.coords.latitude.toFixed(6);
			longitude = position.coords.longitude.toFixed(6);
		});
	}
</script>

<section class="grid two">
	<div class="panel">
		<p class="eyebrow">Availability</p>
		<h1 class="hero-title">Go online with one active vehicle</h1>
		<p class="muted">
			The dispatcher only ranks you if you are online, idle, and have a live location plus one
			active vehicle.
		</p>

		<div class="cards">
			<div class="metric">
				<span class="eyebrow">Driver</span>
				<strong>{data.driver.displayName}</strong>
				<span>{data.driver.phone ?? 'No phone saved'}</span>
			</div>
			<div class="metric">
				<span class="eyebrow">Status</span>
				<strong>{data.availability?.availabilityStatus ?? 'offline'}</strong>
				<span>{data.availability?.isOnline ? 'Online' : 'Offline'}</span>
			</div>
		</div>
	</div>

	<form class="panel stack" method="POST" action="?/updateAvailability">
		<p class="eyebrow">Presence</p>
		{#if form?.error}
			<div class="notice">{form.error}</div>
		{/if}

		<label class="field">
			<span>Active vehicle</span>
			<select name="activeVehicleId">
				<option value="">Select one</option>
				{#each data.vehicles as vehicle (vehicle.id)}
					<option value={vehicle.id} selected={vehicle.id === data.availability?.activeVehicleId}>
						{vehicle.name} ({vehicle.templateKey})
					</option>
				{/each}
			</select>
		</label>

		<div class="grid two">
			<label class="field">
				<span>Latitude</span>
				<input name="latitude" bind:value={latitude} placeholder="-17.829" />
			</label>

			<label class="field">
				<span>Longitude</span>
				<input name="longitude" bind:value={longitude} placeholder="31.052" />
			</label>
		</div>

		<button class="secondary" onclick={useCurrentLocation} type="button">
			Use browser location
		</button>

		<div class="grid two">
			<button class="primary" name="mode" value="online" type="submit">Go online</button>
			<button class="secondary" name="mode" value="offline" type="submit">Go offline</button>
		</div>
	</form>
</section>

<section class="grid two">
	<div class="panel table-card">
		<p class="eyebrow">My Vehicles</p>
		<table>
			<thead>
				<tr>
					<th>Vehicle</th>
					<th>Capacity</th>
					<th>Active</th>
				</tr>
			</thead>
			<tbody>
				{#each data.vehicles as vehicle (vehicle.id)}
					<tr>
						<td>
							<strong>{vehicle.name}</strong>
							<div class="muted">{vehicle.registrationNumber ?? 'No registration'}</div>
						</td>
						<td>
							{vehicle.maxLengthCm}x{vehicle.maxWidthCm}x{vehicle.maxHeightCm} cm
							<div class="muted">{vehicle.maxWeightKg} kg</div>
						</td>
						<td>
							<form method="POST" action="?/setActiveVehicle">
								<input type="hidden" name="vehicleId" value={vehicle.id} />
								<button class={vehicle.isActive ? 'secondary' : 'primary'} type="submit">
									{vehicle.isActive ? 'Active' : 'Make active'}
								</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<form class="panel stack" method="POST" action="?/addVehicle">
		<p class="eyebrow">Add Vehicle</p>

		<label class="field">
			<span>Vehicle name</span>
			<input name="name" placeholder="My weekday Honda Fit" />
		</label>

		<label class="field">
			<span>Registration number</span>
			<input name="registrationNumber" placeholder="ABC-1234" />
		</label>

		<label class="field">
			<span>Template</span>
			<select name="templateKey">
				{#each data.vehicleTemplates as template (template.key)}
					<option value={template.key}>{template.label}</option>
				{/each}
			</select>
		</label>

		<div class="grid two">
			<label class="field">
				<span>Length cm</span>
				<input name="maxLengthCm" placeholder="Optional override" />
			</label>
			<label class="field">
				<span>Width cm</span>
				<input name="maxWidthCm" placeholder="Optional override" />
			</label>
			<label class="field">
				<span>Height cm</span>
				<input name="maxHeightCm" placeholder="Optional override" />
			</label>
			<label class="field">
				<span>Max weight kg</span>
				<input name="maxWeightKg" placeholder="Optional override" />
			</label>
		</div>

		<button class="primary" type="submit">Add vehicle</button>
	</form>
</section>
