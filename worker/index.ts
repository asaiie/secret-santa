import { ADMIN, NAMES, WISHLIST_MAX, isName, type Name } from '../src/lib/names.ts';

interface Env {
	ASSETS: Fetcher;
	DB: D1Database;
	SESSION_SECRET: string;
}

const COOKIE = 'session';
const SESSION_DAYS = 60;
const PBKDF2_ITERATIONS = 100_000; // Workers' maximum for PBKDF2
const MIN_PASSWORD = 4;

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url);
		if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);

		try {
			return await route(req, env, url.pathname);
		} catch (err) {
			if (err instanceof HttpError) return json({ error: err.message }, err.status);
			console.error(err);
			return json({ error: 'Something went wrong' }, 500);
		}
	}
} satisfies ExportedHandler<Env>;

async function route(req: Request, env: Env, path: string): Promise<Response> {
	const method = req.method;

	if (method === 'GET' && path === '/api/users') {
		const { results } = await env.DB.prepare('SELECT name FROM users').all<{ name: string }>();
		const registered = new Set(results.map((r) => r.name));
		return json(NAMES.map((name) => ({ name, hasPassword: registered.has(name) })));
	}

	if (method === 'GET' && path === '/api/me') {
		const name = await currentUser(req, env);
		const drawn = await isDrawn(env);
		return json({ name, isAdmin: name === ADMIN, drawn });
	}

	if (method === 'GET' && path === '/api/wishlist') {
		const name = await requireUser(req, env);
		// Your own wishlist only.
		const row = await env.DB.prepare('SELECT text, updated_at FROM wishlists WHERE name = ?')
			.bind(name)
			.first<{ text: string; updated_at: string }>();
		return json({ text: row?.text ?? '', updatedAt: row?.updated_at ?? null });
	}

	if (method === 'GET' && path === '/api/giftee') {
		const name = await requireUser(req, env);
		// Only ever the signed-in person's own giftee, and only once the draw has happened.
		const row = await env.DB.prepare(
			`SELECT a.recipient, w.text, w.updated_at FROM assignments a
			 LEFT JOIN wishlists w ON w.name = a.recipient WHERE a.giver = ?`
		)
			.bind(name)
			.first<{ recipient: string; text: string | null; updated_at: string | null }>();
		if (!row) return json({ giftee: null });
		return json({ giftee: { name: row.recipient, wishlist: row.text ?? '', updatedAt: row.updated_at } });
	}

	if (method === 'GET' && path === '/api/recipient') {
		const name = await requireUser(req, env);
		// Only ever returns the signed-in person's own recipient.
		const row = await env.DB.prepare('SELECT recipient FROM assignments WHERE giver = ?')
			.bind(name)
			.first<{ recipient: string }>();
		return json({ recipient: row?.recipient ?? null });
	}

	if (method === 'POST') {
		// Requiring JSON means cross-site HTML forms can't hit these endpoints.
		if (!req.headers.get('content-type')?.includes('application/json')) {
			throw new HttpError(415, 'Expected JSON');
		}

		if (path === '/api/set-password') {
			const { name, password } = await credentials(req);
			const salt = randomBase64(16);
			const hash = await hashPassword(password, salt);
			const res = await env.DB.prepare(
				'INSERT INTO users (name, password_hash, salt) VALUES (?, ?, ?) ON CONFLICT(name) DO NOTHING'
			)
				.bind(name, hash, salt)
				.run();
			if (res.meta.changes === 0) throw new HttpError(409, 'That name already has a password');
			return withSession(json({ name }), name, env);
		}

		if (path === '/api/login') {
			const { name, password } = await credentials(req);
			const row = await env.DB.prepare('SELECT password_hash, salt FROM users WHERE name = ?')
				.bind(name)
				.first<{ password_hash: string; salt: string }>();
			if (!row) throw new HttpError(404, 'No password set for that name yet');
			const hash = await hashPassword(password, row.salt);
			if (!timingSafeEqual(hash, row.password_hash)) throw new HttpError(401, 'Wrong password');
			return withSession(json({ name }), name, env);
		}

		if (path === '/api/logout') {
			return json({ ok: true }, 200, {
				'set-cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
			});
		}

		if (path === '/api/wishlist') {
			const name = await requireUser(req, env);
			const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
			if (typeof body?.text !== 'string') throw new HttpError(400, 'Expected text');
			if (body.text.length > WISHLIST_MAX) {
				throw new HttpError(400, `Wishlist is limited to ${WISHLIST_MAX} characters`);
			}
			const row = await env.DB.prepare(
				`INSERT INTO wishlists (name, text, updated_at) VALUES (?, ?, datetime('now'))
				 ON CONFLICT(name) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at
				 RETURNING updated_at`
			)
				.bind(name, body.text)
				.first<{ updated_at: string }>();
			return json({ updatedAt: row?.updated_at ?? null });
		}

		if (path === '/api/draw') {
			const name = await requireUser(req, env);
			if (name !== ADMIN) throw new HttpError(403, 'Only the organizer can run the draw');
			if (await isDrawn(env)) throw new HttpError(409, 'The draw has already happened');
			await runDraw(env);
			// Deliberately returns nothing about the pairings.
			return json({ ok: true });
		}
	}

	throw new HttpError(404, 'Not found');
}

/**
 * Shuffles everyone into one loop (A→B→C→…→A): nobody gets themselves and
 * no two people get each other.
 */
async function runDraw(env: Env) {
	const order = [...NAMES];
	for (let i = order.length - 1; i > 0; i--) {
		const j = randomInt(i + 1);
		[order[i], order[j]] = [order[j], order[i]];
	}
	const insert = env.DB.prepare('INSERT INTO assignments (giver, recipient) VALUES (?, ?)');
	// batch() runs as one transaction; the giver primary key makes a second concurrent draw fail.
	await env.DB.batch(order.map((giver, i) => insert.bind(giver, order[(i + 1) % order.length])));
}

async function isDrawn(env: Env) {
	return (await env.DB.prepare('SELECT 1 FROM assignments LIMIT 1').first()) !== null;
}

// ---------- request helpers ----------

class HttpError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers }
	});
}

async function credentials(req: Request): Promise<{ name: Name; password: string }> {
	const body = (await req.json().catch(() => null)) as { name?: unknown; password?: unknown } | null;
	if (!isName(body?.name)) throw new HttpError(400, 'Pick a name from the list');
	if (typeof body.password !== 'string' || body.password.length < MIN_PASSWORD) {
		throw new HttpError(400, `Password must be at least ${MIN_PASSWORD} characters`);
	}
	return { name: body.name, password: body.password };
}

// ---------- sessions: HMAC-signed cookie "name.expiry.signature" ----------

async function withSession(res: Response, name: Name, env: Env) {
	const expires = Date.now() + SESSION_DAYS * 864e5;
	const payload = `${name}.${expires}`;
	const sig = await hmac(env, payload);
	res.headers.append(
		'set-cookie',
		`${COOKIE}=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`
	);
	return res;
}

async function currentUser(req: Request, env: Env): Promise<Name | null> {
	const cookie = req.headers
		.get('cookie')
		?.split(/;\s*/)
		.find((c) => c.startsWith(`${COOKIE}=`))
		?.slice(COOKIE.length + 1);
	if (!cookie) return null;
	const [name, expires, sig] = cookie.split('.');
	if (!isName(name) || !sig || Number(expires) < Date.now()) return null;
	const expected = await hmac(env, `${name}.${expires}`);
	return timingSafeEqual(sig, expected) ? name : null;
}

async function requireUser(req: Request, env: Env) {
	const name = await currentUser(req, env);
	if (!name) throw new HttpError(401, 'Please sign in');
	return name;
}

async function hmac(env: Env, data: string) {
	if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET is not set');
	const key = await crypto.subtle.importKey(
		'raw',
		enc(env.SESSION_SECRET),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	return toBase64(await crypto.subtle.sign('HMAC', key, enc(data)));
}

// ---------- crypto helpers ----------

async function hashPassword(password: string, salt: string) {
	const key = await crypto.subtle.importKey('raw', enc(password), 'PBKDF2', false, ['deriveBits']);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt: enc(salt), iterations: PBKDF2_ITERATIONS },
		key,
		256
	);
	return toBase64(bits);
}

function timingSafeEqual(a: string, b: string) {
	const ab = enc(a);
	const bb = enc(b);
	return ab.byteLength === bb.byteLength && crypto.subtle.timingSafeEqual(ab, bb);
}

/** Unbiased random integer in [0, max). */
function randomInt(max: number) {
	const limit = Math.floor(0x1_0000_0000 / max) * max;
	const buf = new Uint32Array(1);
	do crypto.getRandomValues(buf);
	while (buf[0] >= limit);
	return buf[0] % max;
}

const enc = (s: string) => new TextEncoder().encode(s);

const randomBase64 = (bytes: number) => toBase64(crypto.getRandomValues(new Uint8Array(bytes)));

function toBase64(buf: ArrayBuffer | Uint8Array) {
	const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}
