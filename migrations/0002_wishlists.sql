-- One wishlist per person; written only by its owner.
CREATE TABLE wishlists (
	name TEXT PRIMARY KEY,
	text TEXT NOT NULL DEFAULT '',
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
