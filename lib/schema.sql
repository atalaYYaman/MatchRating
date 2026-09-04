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
  ratings_breakdown_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE groups ADD COLUMN IF NOT EXISTS ratings_breakdown_public BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE group_members ADD COLUMN IF NOT EXISTS nickname TEXT;

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

CREATE TABLE IF NOT EXISTS position_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  primary_position TEXT NOT NULL,
  secondary_position TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, voter_id, target_id),
  CHECK (primary_position <> secondary_position),
  CHECK (primary_position IN ('kaleci', 'stoper', 'bek', 'orta_saha', 'kanat', 'forvet')),
  CHECK (secondary_position IN ('kaleci', 'stoper', 'bek', 'orta_saha', 'kanat', 'forvet'))
);

CREATE INDEX IF NOT EXISTS idx_position_votes_group_target ON position_votes (group_id, target_id);

-- ==========================================================================
-- MAC SISTEMI
-- ==========================================================================

-- mode: 'poll' -> once anket, sonra yonetici bir secenegi kesinlestirir.
--       'fixed' -> bilgiler bastan kesin, sadece yoklama alinir.
-- match_kind: 'ic' -> takim ici, 'dis' -> disaridan rakibe karsi.
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('poll', 'fixed')),
  match_kind TEXT NOT NULL CHECK (match_kind IN ('ic', 'dis')),
  required_players SMALLINT,
  note TEXT,
  -- Kesinlesen bilgiler: fixed'de bastan dolu, poll'de kesinlestirilince dolar.
  scheduled_at TIMESTAMPTZ,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'poll_open'
    CHECK (status IN ('poll_open', 'scheduled', 'completed', 'cancelled')),
  ratings_processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matches_group ON matches (group_id, created_at DESC);

-- Mac sonucu. 'dis' maclarda home = bizim takim, away = rakip; 'ic' maclarda
-- iki taraf da grup icinden (ornek: Yesiller / Beyazlar), bu yuzden galibiyet
-- istatistigi yalnizca 'dis' maclardan hesaplanir.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_score SMALLINT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_score SMALLINT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_label TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_label TEXT;
-- Yoklamanin kapandigi an; bos ise mac saatine kadar acik.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS rsvp_deadline TIMESTAMPTZ;

-- Anket secenekleri: her satir bir (gun+saat, konum) kombinasyonu.
CREATE TABLE IF NOT EXISTS match_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  location TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_options_match ON match_options (match_id);

-- Ankete cevap: available=false ise "hicbirine katilamam".
CREATE TABLE IF NOT EXISTS match_poll_responses (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  available BOOLEAN NOT NULL,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id)
);

-- Uyenin uygun bulduğu secenekler (birden fazla secilebilir).
CREATE TABLE IF NOT EXISTS match_poll_option_votes (
  option_id UUID NOT NULL REFERENCES match_options(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (option_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_option_votes_match ON match_poll_option_votes (match_id);

-- Kesinlesmis mac icin yoklama.
CREATE TABLE IF NOT EXISTS match_attendance (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('yes', 'no')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id)
);

-- Mac sonrasi 10 uzerinden puanlama + 1 guclu / 1 zayif yon.
CREATE TABLE IF NOT EXISTS match_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score NUMERIC(3, 1) NOT NULL CHECK (score >= 0 AND score <= 10),
  strength_skill TEXT NOT NULL,
  weakness_skill TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, rater_id, target_id),
  CHECK (strength_skill <> weakness_skill),
  CHECK (rater_id <> target_id)
);

CREATE INDEX IF NOT EXISTS idx_match_ratings_match ON match_ratings (match_id);

-- Mac sonuclarindan dogan yetenek puani duzeltmeleri. Oy tabanli temel puanin
-- uzerine eklenir (lib/ratings.ts).
-- reason: 'match_rating' | 'no_rating_penalty'
CREATE TABLE IF NOT EXISTS skill_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  delta NUMERIC(5, 2) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_adjustments_group_user
  ON skill_adjustments (group_id, user_id);

-- Mevcut veritabanlarinda 1-10 kisitini 60-90'a guncelle.
-- Once eski CHECK kalkar (yoksa 60-90'a cevirme basarisiz olur), sonra skorlar
-- dogrusal map edilir (1->60, 10->90), en sonda yeni kisit eklenir.
ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_score_check;
UPDATE votes
SET score = ROUND(60 + (score - 1) * 30.0 / 9)::smallint
WHERE score BETWEEN 1 AND 10;
ALTER TABLE votes ADD CONSTRAINT votes_score_check CHECK (score BETWEEN 60 AND 90);

-- ==========================================================================
-- KADROLAR (mac ici takim ayrimi)
-- ==========================================================================

-- Kadrolar yalnizca match_kind='ic' maclarda kullanilir: katilimcilar
-- guce/mevkiye gore iki tarafa (home/away) bolunur.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS squads_locked_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS match_squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('home', 'away')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, side)
);

-- Her satir ya kayitli bir uyedir (user_id) ya da misafirdir (guest_name);
-- ikisi birden olamaz. overall/mevki, kadro olusturuldugu andaki guc
-- puaninin bir kopyasidir (oyuncunun puani sonradan degisse de kadro sabit
-- kalir); goruntulemede isim yine de canli cekilir.
CREATE TABLE IF NOT EXISTS match_squad_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID NOT NULL REFERENCES match_squads(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_name TEXT,
  overall SMALLINT NOT NULL,
  primary_position TEXT,
  secondary_position TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((user_id IS NULL) <> (guest_name IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_squad_players_squad ON match_squad_players (squad_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_squad_players_match_user
  ON match_squad_players (match_id, user_id) WHERE user_id IS NOT NULL;

-- ==========================================================================
-- SEZONLAR
-- ==========================================================================

-- Her grubun her an tek bir aktif sezonu olur. Yonetici elle kapatinca
-- o anki durum (siralamalar, G-B-M, MVP) summary'ye dondurulur ve otomatik
-- adli yeni bir sezon acilir. Yetenek puanlari/oylari sezonlar arasi korunur;
-- sezon yalnizca maclari ve galibiyet kaydini kapsayan bir zaman penceresidir.
CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_seasons_group ON seasons (group_id, created_at DESC);
-- Grup basina en fazla bir aktif sezon.
CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_one_active
  ON seasons (group_id) WHERE status = 'active';

ALTER TABLE matches ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_matches_season ON matches (season_id);

-- Backfill: aktif sezonu olmayan her gruba "Sezon 1" ekle, ardindan sezonu
-- olmayan maclari o gruptaki aktif sezona bagla. Idempotent (db:init her
-- calistiginda guvenle tekrarlanabilir).
INSERT INTO seasons (group_id, name, status)
SELECT g.id, 'Sezon 1', 'active'
FROM groups g
WHERE NOT EXISTS (
  SELECT 1 FROM seasons s WHERE s.group_id = g.id AND s.status = 'active'
);

UPDATE matches m
SET season_id = s.id
FROM seasons s
WHERE m.season_id IS NULL
  AND s.group_id = m.group_id
  AND s.status = 'active';

-- ==========================================================================
-- ANKET KAPANIS TARIHI
-- ==========================================================================

-- Anket bu ana kadar acik kalir; sure dolunca en cok oy alan secenek
-- otomatik kesinlesir (beraberlikte en erken tarih kazanir). Hic oy yoksa
-- otomatik secim yapilmaz, yonetici elle secer.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS poll_closes_at TIMESTAMPTZ;
