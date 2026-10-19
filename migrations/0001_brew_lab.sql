CREATE TABLE "user" (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  createdAt DATE NOT NULL,
  updatedAt DATE NOT NULL
);

CREATE TABLE "session" (
  id TEXT PRIMARY KEY NOT NULL,
  expiresAt DATE NOT NULL,
  token TEXT NOT NULL UNIQUE,
  createdAt DATE NOT NULL,
  updatedAt DATE NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);
CREATE INDEX session_user ON "session"(userId);

CREATE TABLE account (
  id TEXT PRIMARY KEY NOT NULL,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  accessToken TEXT,
  refreshToken TEXT,
  idToken TEXT,
  accessTokenExpiresAt DATE,
  refreshTokenExpiresAt DATE,
  scope TEXT,
  password TEXT,
  createdAt DATE NOT NULL,
  updatedAt DATE NOT NULL
);
CREATE INDEX account_user ON account(userId);

CREATE TABLE verification (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt DATE NOT NULL,
  createdAt DATE NOT NULL,
  updatedAt DATE NOT NULL
);
CREATE INDEX verification_identifier ON verification(identifier);

CREATE TABLE "rateLimit" (
  id TEXT PRIMARY KEY NOT NULL,
  "key" TEXT NOT NULL UNIQUE,
  count INTEGER NOT NULL,
  lastRequest INTEGER NOT NULL
);

CREATE TABLE inventories (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  items TEXT NOT NULL CHECK (json_valid(items) AND json_type(items) = 'array'),
  source TEXT NOT NULL CHECK (source IN ('manual', 'brewfather')),
  synced_at TEXT NOT NULL
);

CREATE TABLE suppliers (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  id TEXT NOT NULL CHECK (length(id) BETWEEN 1 AND 160),
  profile TEXT NOT NULL CHECK (json_valid(profile) AND json_type(profile) = 'object'),
  checked_at TEXT,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE recipes (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
  recipe TEXT NOT NULL CHECK (json_valid(recipe) AND json_type(recipe) = 'object'),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX recipes_owner_updated ON recipes(user_id, updated_at DESC);

CREATE TABLE api_usage (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('ai', 'sync')),
  bucket INTEGER NOT NULL,
  requests INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, action, bucket)
);