export type PackagePresetSeed = {
	key: string;
	label: string;
	description: string;
	sortOrder: number;
	maxLengthCm: number;
	maxWidthCm: number;
	maxHeightCm: number;
	maxWeightKg: number;
};

export type VehicleTemplate = {
	key: string;
	label: string;
	description: string;
	capacityTier: number;
	maxLengthCm: number;
	maxWidthCm: number;
	maxHeightCm: number;
	maxWeightKg: number;
};

export const packagePresetSeeds: PackagePresetSeed[] = [
	{
		key: 'micro',
		label: 'Micro parcel',
		description: 'Documents, envelopes, chargers, and very small hand-carried parcels.',
		sortOrder: 1,
		maxLengthCm: 30,
		maxWidthCm: 20,
		maxHeightCm: 5,
		maxWeightKg: 1
	},
	{
		key: 'compact',
		label: 'Compact parcel',
		description: 'Typical e-commerce parcel that still fits in a small hatchback easily.',
		sortOrder: 2,
		maxLengthCm: 45,
		maxWidthCm: 30,
		maxHeightCm: 20,
		maxWeightKg: 5
	},
	{
		key: 'standard',
		label: 'Standard box',
		description: 'Boxed household or office deliveries that need more boot space.',
		sortOrder: 3,
		maxLengthCm: 70,
		maxWidthCm: 50,
		maxHeightCm: 40,
		maxWeightKg: 20
	},
	{
		key: 'oversized',
		label: 'Oversized cargo',
		description: 'Bulky freight that likely needs a van or truck.',
		sortOrder: 4,
		maxLengthCm: 220,
		maxWidthCm: 150,
		maxHeightCm: 150,
		maxWeightKg: 800
	}
];

export const vehicleTemplates: VehicleTemplate[] = [
	{
		key: 'honda-fit',
		label: 'Honda Fit / hatchback',
		description: 'Best for documents and compact parcels.',
		capacityTier: 1,
		maxLengthCm: 110,
		maxWidthCm: 90,
		maxHeightCm: 70,
		maxWeightKg: 80
	},
	{
		key: 'pickup',
		label: 'Pickup',
		description: 'Handles wider or heavier parcels without going to truck class.',
		capacityTier: 2,
		maxLengthCm: 180,
		maxWidthCm: 140,
		maxHeightCm: 110,
		maxWeightKg: 500
	},
	{
		key: 'panel-van',
		label: 'Panel van',
		description: 'Good for office moves, batches, and bulk retail runs.',
		capacityTier: 3,
		maxLengthCm: 260,
		maxWidthCm: 160,
		maxHeightCm: 150,
		maxWeightKg: 1200
	},
	{
		key: 'box-truck',
		label: 'Box truck',
		description: 'Heavy or oversized cargo.',
		capacityTier: 4,
		maxLengthCm: 420,
		maxWidthCm: 210,
		maxHeightCm: 220,
		maxWeightKg: 5000
	}
];

export const driverDemoProfiles = [
	{
		name: 'Rudo Moyo',
		email: 'driver1@example.com',
		phone: '+263771000001',
		vehicle: 'honda-fit'
	},
	{
		name: 'Tawanda Ncube',
		email: 'driver2@example.com',
		phone: '+263771000002',
		vehicle: 'pickup'
	},
	{
		name: 'Simba Dube',
		email: 'driver3@example.com',
		phone: '+263771000003',
		vehicle: 'box-truck'
	}
] as const;
