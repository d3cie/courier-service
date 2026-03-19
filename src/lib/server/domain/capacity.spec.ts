import { describe, expect, it } from 'vitest';

import { buildVehicleCapacity, calculateVolumeCm3, fitsVehicle } from './capacity';

describe('capacity rules', () => {
	it('fits a compact parcel into a hatchback template', () => {
		const hatchback = buildVehicleCapacity({
			maxLengthCm: 110,
			maxWidthCm: 90,
			maxHeightCm: 70,
			maxWeightKg: 80,
			capacityTier: 1
		});

		expect(
			fitsVehicle(
				{
					lengthCm: 35,
					widthCm: 25,
					heightCm: 15,
					weightKg: 3,
					volumeCm3: calculateVolumeCm3(35, 25, 15)
				},
				hatchback
			)
		).toBe(true);
	});

	it('rejects oversized cargo for a hatchback template', () => {
		const hatchback = buildVehicleCapacity({
			maxLengthCm: 110,
			maxWidthCm: 90,
			maxHeightCm: 70,
			maxWeightKg: 80,
			capacityTier: 1
		});

		expect(
			fitsVehicle(
				{
					lengthCm: 180,
					widthCm: 110,
					heightCm: 90,
					weightKg: 120,
					volumeCm3: calculateVolumeCm3(180, 110, 90)
				},
				hatchback
			)
		).toBe(false);
	});
});
