import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { vi } from 'vitest';

export async function createTestContext() {
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'courier-service-'));
	process.env.DATABASE_URL = path.join(tempDir, 'test.sqlite');
	process.env.WHATSAPP_AUTH_PATH = path.join(tempDir, '.wwebjs_auth');
	vi.resetModules();

	const bootstrap = await import('$lib/server/db/bootstrap');
	await bootstrap.ensureDatabaseReady();

	const client = await import('$lib/server/db/client');
	const schema = await import('$lib/server/db/schema');
	const services = await import('$lib/server/services/container');

	return {
		tempDir,
		db: client.db,
		schema,
		services: services.createCourierServices()
	};
}
