import type { Name } from './names.ts';

export type User = { name: Name; hasPassword: boolean };
export type Me = { name: Name | null; isAdmin: boolean; drawn: boolean };

async function request<T>(path: string, body?: unknown): Promise<T> {
	const res = await fetch(path, {
		method: body === undefined ? 'GET' : 'POST',
		headers: body === undefined ? {} : { 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
	return data as T;
}

export const api = {
	users: () => request<User[]>('/api/users'),
	me: () => request<Me>('/api/me'),
	recipient: () => request<{ recipient: Name | null }>('/api/recipient'),
	setPassword: (name: Name, password: string) =>
		request<{ name: Name }>('/api/set-password', { name, password }),
	login: (name: Name, password: string) => request<{ name: Name }>('/api/login', { name, password }),
	logout: () => request<{ ok: true }>('/api/logout', {}),
	draw: () => request<{ ok: true }>('/api/draw', {})
};
