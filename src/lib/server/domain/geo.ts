const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number) {
	return (degrees * Math.PI) / 180;
}

export function haversineDistanceMeters(
	origin: { latitude: number; longitude: number },
	destination: { latitude: number; longitude: number }
) {
	const dLat = toRadians(destination.latitude - origin.latitude);
	const dLon = toRadians(destination.longitude - origin.longitude);
	const lat1 = toRadians(origin.latitude);
	const lat2 = toRadians(destination.latitude);

	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

	return Math.round(2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
