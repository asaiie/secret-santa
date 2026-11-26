CREATE TABLE users (
	name TEXT PRIMARY KEY,
	password_hash TEXT NOT NULL,
	salt TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Written only by the draw, inside the Worker. Never committed, never sent to the browser
-- except a giver's own recipient.
CREATE TABLE assignments (
	giver TEXT PRIMARY KEY,
	recipient TEXT NOT NULL UNIQUE
);
