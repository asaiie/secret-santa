import { api, type Me } from './api.ts';

/** Shared signed-in state for every page. */
export const session = $state<{ me: Me | null; loaded: boolean }>({ me: null, loaded: false });

export async function refreshSession() {
	try {
		session.me = await api.me();
	} catch {
		session.me = null;
	} finally {
		session.loaded = true;
	}
}
