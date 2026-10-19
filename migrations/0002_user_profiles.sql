CREATE TABLE user_profiles (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  ai_provider TEXT NOT NULL DEFAULT 'openai' CHECK (ai_provider IN ('openai', 'gemini', 'anthropic')),
  ai_model TEXT NOT NULL DEFAULT 'gpt-4.1-mini',
  openai_key TEXT,
  gemini_key TEXT,
  anthropic_key TEXT,
  brewfather_user_id TEXT NOT NULL DEFAULT '',
  brewfather_version TEXT NOT NULL DEFAULT 'v2' CHECK (brewfather_version IN ('v1', 'v2')),
  brewfather_key TEXT
);