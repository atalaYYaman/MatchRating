-- MatchRating veritabani semasi
-- scripts/init-db.mjs bu dosyayi okuyup calistirir.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  score SMALLINT NOT NULL CHECK (score BETWEEN 60 AND 90),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, voter_id, target_id, skill)
);

CREATE INDEX IF NOT EXISTS idx_votes_group_target ON votes (group_id, target_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members (user_id);

-- Mevcut veritabanlarinda 1-10 kisitini 60-90'a guncelle.
-- Once eski CHECK kalkar (yoksa 60-90'a cevirme basarisiz olur), sonra skorlar
-- dogrusal map edilir (1->60, 10->90), en sonda yeni kisit eklenir.
ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_score_check;
UPDATE votes
SET score = ROUND(60 + (score - 1) * 30.0 / 9)::smallint
WHERE score BETWEEN 1 AND 10;
ALTER TABLE votes ADD CONSTRAINT votes_score_check CHECK (score BETWEEN 60 AND 90);
