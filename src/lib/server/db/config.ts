import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultDatabaseLocation = path.join('data', 'courier.sqlite');
const remoteUrlPattern = /^(?:libsql|https?|wss?):/i;

export function resolveDatabaseConfig(databaseLocation = process.env.DATABASE_URL?.trim()) {
	const location = databaseLocation || defaultDatabaseLocation;

	if (location.startsWith('file:')) {
		return {
			databasePath: fileURLToPath(location),
			databaseUrl: location
		};
	}

	if (remoteUrlPattern.test(location) || location === ':memory:') {
		return {
			databasePath: null,
			databaseUrl: location
		};
	}

	const databasePath = path.resolve(process.cwd(), location);

	return {
		databasePath,
		databaseUrl: pathToFileURL(databasePath).href
	};
}
