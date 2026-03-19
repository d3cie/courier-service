import { packagePresetSeeds, vehicleTemplates } from '$lib/server/db/catalog';

export type Dimensions = {
	lengthCm: number;
	widthCm: number;
	heightCm: number;
};

export type PackageShape = Dimensions & {
	weightKg: number;
	volumeCm3: number;
};

export type VehicleCapacity = Dimensions & {
	maxWeightKg: number;
	maxVolumeCm3: number;
	capacityTier: number;
};

export function calculateVolumeCm3(lengthCm: number, widthCm: number, heightCm: number) {
	return Math.round(lengthCm * widthCm * heightCm);
}

export function parseDimensionsInput(input: string): Dimensions | null {
	const cleaned = input.trim().toLowerCase();
	const match = cleaned.match(
		/^(\d+(?:\.\d+)?)\s*(?:x|\*|,|\s)\s*(\d+(?:\.\d+)?)\s*(?:x|\*|,|\s)\s*(\d+(?:\.\d+)?)$/
	);

	if (!match) {
		return null;
	}

	const [, lengthRaw, widthRaw, heightRaw] = match;
	const lengthCm = Math.round(Number(lengthRaw));
	const widthCm = Math.round(Number(widthRaw));
	const heightCm = Math.round(Number(heightRaw));

	if ([lengthCm, widthCm, heightCm].some((value) => !Number.isFinite(value) || value <= 0)) {
		return null;
	}

	return { lengthCm, widthCm, heightCm };
}

export function parseWeightInput(input: string) {
	const normalized = Number.parseFloat(input.trim().replace(/kg$/i, ''));

	if (!Number.isFinite(normalized) || normalized <= 0) {
		return null;
	}

	return Math.round(normalized * 100) / 100;
}

export function formatDimensions(dimensions: Dimensions) {
	return `${dimensions.lengthCm} x ${dimensions.widthCm} x ${dimensions.heightCm} cm`;
}

export function fitsVehicle(pkg: PackageShape, vehicle: VehicleCapacity) {
	return (
		pkg.lengthCm <= vehicle.lengthCm &&
		pkg.widthCm <= vehicle.widthCm &&
		pkg.heightCm <= vehicle.heightCm &&
		pkg.weightKg <= vehicle.maxWeightKg &&
		pkg.volumeCm3 <= vehicle.maxVolumeCm3
	);
}

export function fitsPreset(
	dimensions: Dimensions,
	weightKg: number,
	preset: Pick<
		(typeof packagePresetSeeds)[number],
		'maxLengthCm' | 'maxWidthCm' | 'maxHeightCm' | 'maxWeightKg'
	>
) {
	const volumeCm3 = calculateVolumeCm3(
		dimensions.lengthCm,
		dimensions.widthCm,
		dimensions.heightCm
	);
	const presetVolumeCm3 = calculateVolumeCm3(
		preset.maxLengthCm,
		preset.maxWidthCm,
		preset.maxHeightCm
	);

	return (
		dimensions.lengthCm <= preset.maxLengthCm &&
		dimensions.widthCm <= preset.maxWidthCm &&
		dimensions.heightCm <= preset.maxHeightCm &&
		weightKg <= preset.maxWeightKg &&
		volumeCm3 <= presetVolumeCm3
	);
}

export function getVehicleTemplate(templateKey: string) {
	return vehicleTemplates.find((template) => template.key === templateKey) ?? null;
}

export function getPackagePresetSeed(key: string) {
	return packagePresetSeeds.find((preset) => preset.key === key) ?? null;
}

export function buildVehicleCapacity(input: {
	maxLengthCm: number;
	maxWidthCm: number;
	maxHeightCm: number;
	maxWeightKg: number;
	capacityTier: number;
}) {
	return {
		lengthCm: input.maxLengthCm,
		widthCm: input.maxWidthCm,
		heightCm: input.maxHeightCm,
		maxWeightKg: input.maxWeightKg,
		maxVolumeCm3: calculateVolumeCm3(input.maxLengthCm, input.maxWidthCm, input.maxHeightCm),
		capacityTier: input.capacityTier
	};
}
