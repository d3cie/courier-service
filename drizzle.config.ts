import { defineConfig } from 'drizzle-kit';

import { resolveDatabaseConfig } from './src/lib/server/db/config';

const { databasePath, databaseUrl } = resolveDatabaseConfig();

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: {
		url: databasePath ?? databaseUrl
	}
});
