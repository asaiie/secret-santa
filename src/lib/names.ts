export const NAMES = [
	'Amit',
	'Abhinav',
	'Amol',
	'Anant',
	'Bilal',
	'Edward',
	'Garv',
	'John',
	'Manas',
	'Praneeth',
	'Sayan',
	'Zubin'
] as const;

export type Name = (typeof NAMES)[number];

export const ADMIN: Name = 'Amit';

export const isName = (v: unknown): v is Name =>
	typeof v === 'string' && (NAMES as readonly string[]).includes(v);
