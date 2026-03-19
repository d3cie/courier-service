import fs from 'node:fs';
import path from 'node:path';

import { migrate } from 'drizzle-orm/libsql/migrator';

import { db } from './client';
import { seedDatabase } from './seed';

let readyPromise: Promise<void> | null = null;

export function ensureDatabaseReady() {
	if (!readyPromise) {
		readyPromise = (async () => {
			const migrationsFolder = path.join(process.cwd(), 'drizzle');
			fs.mkdirSync(migrationsFolder, { recursive: true });
			await migrate(db, { migrationsFolder });
			await seedDatabase();
		})();
	}

	return readyPromise;
}
