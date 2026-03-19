const { ensureDatabaseReady } = await import('../src/lib/server/db/bootstrap');

await ensureDatabaseReady();
console.log('Database migrated and seeded.');
