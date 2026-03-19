import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import { resolveDatabaseConfig } from './config';
import * as schema from './schema';

const databaseConfig = resolveDatabaseConfig();

export const databasePath = databaseConfig.databasePath;
export const databaseUrl = databaseConfig.databaseUrl;

if (databasePath) {
	fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

export const sqlite = createClient({ url: databaseUrl });

await sqlite.execute('PRAGMA foreign_keys = ON');

if (databasePath) {
	await sqlite.execute('PRAGMA journal_mode = WAL');
}

export const db = drizzle(sqlite, { schema });

export type AppDatabase = typeof db;
