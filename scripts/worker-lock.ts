import fs from 'node:fs';
import path from 'node:path';

function getWorkerIdentity() {
	const clientId = process.env.WHATSAPP_CLIENT_ID ?? 'courier-primary';
	const authPath = path.resolve(
		process.cwd(),
		process.env.WHATSAPP_AUTH_PATH ?? path.join('data', '.wwebjs_auth')
	);
	const lockPath = path.join(authPath, `session-${clientId}.worker.lock`);

	return { authPath, clientId, lockPath };
}

function isProcessAlive(pid: number) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function readLockedPid(lockPath: string) {
	try {
		const raw = fs.readFileSync(lockPath, 'utf8').trim();
		const pid = Number(raw);
		return Number.isInteger(pid) && pid > 0 ? pid : null;
	} catch {
		return null;
	}
}

export function acquireWorkerLock() {
	const { authPath, clientId, lockPath } = getWorkerIdentity();
	fs.mkdirSync(authPath, { recursive: true });

	const tryCreateLock = () => {
		fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
	};

	try {
		tryCreateLock();
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
			throw error;
		}

		const lockedPid = readLockedPid(lockPath);
		if (lockedPid && isProcessAlive(lockedPid)) {
			throw new Error(
				`WhatsApp worker is already running for "${clientId}" (pid ${lockedPid}). Stop the existing worker or set a different WHATSAPP_CLIENT_ID.`
			);
		}

		fs.rmSync(lockPath, { force: true });
		tryCreateLock();
	}

	return () => {
		const lockedPid = readLockedPid(lockPath);
		if (lockedPid === process.pid) {
			fs.rmSync(lockPath, { force: true });
		}
	};
}
