import { acquireWorkerLock } from './worker-lock';

let releaseWorkerLock: (() => void) | undefined;

try {
	releaseWorkerLock = acquireWorkerLock();
	process.on('exit', () => releaseWorkerLock?.());

	const { startCourierWorker } = await import('../src/lib/server/services/worker');
	await startCourierWorker();
} catch (error) {
	if (error instanceof Error) {
		if (error.message.includes('The browser is already running for')) {
			console.error(
				'WhatsApp worker is already using this auth session. Stop every existing `pnpm worker` or `pnpm dev:worker` process, then start a single worker.'
			);
			process.exit(1);
		}

		if (error.message.includes('WhatsApp worker is already running for')) {
			console.error(error.message);
			process.exit(1);
		}
	}

	throw error;
}
