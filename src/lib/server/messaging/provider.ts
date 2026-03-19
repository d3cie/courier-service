import { EventEmitter } from 'node:events';

import type { MessagingProvider } from './types';

export type EventedMessagingProvider = MessagingProvider & EventEmitter;

export function phoneFromJid(jid: string) {
	return jid.replace(/@.*$/, '');
}
