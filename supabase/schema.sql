-- =====================================================
-- PICKLEBALL COURT MANAGEMENT SYSTEM
-- Full Database Schema for Supabase (PostgreSQL)
-- Run this in your Supabase SQL Editor
-- =====================================================

-- ─── EXTENSIONS ───────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── ENUMS ────────────────────────────────────────────
CREATE TYPE user_role        AS ENUM ('player', 'owner');
CREATE TYPE skill_tier       AS ENUM ('beginner', 'intermediate', 'advanced', 'professional');
CREATE TYPE booking_status   AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
CREATE TYPE session_status   AS ENUM ('pending', 'active', 'completed', 'cancelled');
CREATE TYPE match_format     AS ENUM ('singles', 'doubles');
CREATE TYPE queue_status     AS ENUM ('waiting', 'preparing', 'in_match', 'completed', 'removed');
CREATE TYPE payment_status   AS ENUM ('unpaid', 'paid', 'refunded');

-- ─── PROFILES ─────────────────────────────────────────
-- Extends Supabase auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  username        TEXT UNIQUE NOT NULL,
  phone           TEXT,
  avatar_url      TEXT,
  role            user_role NOT NULL DEFAULT 'player',
  date_of_birth   DATE,
  gender          TEXT,
  address         TEXT,
  emergency_contact TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── PLAYER SKILLS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_skills (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill_tier          skill_tier NOT NULL DEFAULT 'beginner',
  -- Self-assessed ratings (1–10)
  serve_rating        SMALLINT DEFAULT 5 CHECK (serve_rating BETWEEN 1 AND 10),
  return_rating       SMALLINT DEFAULT 5 CHECK (return_rating BETWEEN 1 AND 10),
  dink_rating         SMALLINT DEFAULT 5 CHECK (dink_rating BETWEEN 1 AND 10),
  volley_rating       SMALLINT DEFAULT 5 CHECK (volley_rating BETWEEN 1 AND 10),
  mobility_rating     SMALLINT DEFAULT 5 CHECK (mobility_rating BETWEEN 1 AND 10),
  -- Computed stats
  total_games         INTEGER NOT NULL DEFAULT 0,
  total_wins          INTEGER NOT NULL DEFAULT 0,
  total_losses        INTEGER NOT NULL DEFAULT 0,
  current_win_streak  INTEGER NOT NULL DEFAULT 0,
  -- Numeric skill score for matching (auto-computed)
  skill_score         NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  notes               TEXT,
  verified_by_owner   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id)
);

-- ─── COURTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default courts
INSERT INTO courts (name, description) VALUES
  ('Court 1', 'Main court'),
  ('Court 2', 'Side court'),
  ('Court 3', 'Indoor court'),
  ('Court 4', 'Outdoor court')
ON CONFLICT DO NOTHING;

-- ─── BOOKINGS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  court_id        UUID REFERENCES courts(id),
  booking_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  preferred_time  TIME,
  match_format    match_format NOT NULL DEFAULT 'doubles',
  status          booking_status NOT NULL DEFAULT 'pending',
  payment_status  payment_status NOT NULL DEFAULT 'unpaid',
  fee             NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  -- Tracks if player is a walk-in (added by owner, not self-booked)
  is_walkin       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SESSIONS ─────────────────────────────────────────
-- A session is a game block created by the owner
-- expires_at: session expires 24 hours after session_date
CREATE TABLE IF NOT EXISTS sessions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id              UUID NOT NULL REFERENCES profiles(id),
  court_id              UUID REFERENCES courts(id),
  name                  TEXT NOT NULL DEFAULT 'Game Session',
  description           TEXT,
  match_format          match_format NOT NULL DEFAULT 'doubles',
  status                session_status NOT NULL DEFAULT 'pending',
  session_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at            TIMESTAMPTZ,  -- Session expires 24 hours after session_date
  start_time            TIMESTAMPTZ,
  end_time              TIMESTAMPTZ,
  max_players           INTEGER NOT NULL DEFAULT 16,
  fee_per_player        NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SESSION PLAYERS ──────────────────────────────────
-- Which players are participating in a session
CREATE TABLE IF NOT EXISTS session_players (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id      UUID REFERENCES bookings(id),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_walkin       BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (session_id, player_id)
);

-- ─── QUEUE ENTRIES ────────────────────────────────────
-- The smart queue / stacking for a session
CREATE TABLE IF NOT EXISTS queue_entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Position in queue (1 = first to play)
  position        INTEGER NOT NULL,
  -- Which match group this player is in (e.g. match_group=1 = currently playing)
  match_group     INTEGER,
  -- Which team within the match group (1 or 2)
  team            SMALLINT CHECK (team IN (1, 2)),
  status          queue_status NOT NULL DEFAULT 'waiting',
  -- Track how many times this player has played in this session
  games_played    INTEGER NOT NULL DEFAULT 0,
  -- Original booking time for FCFS ordering
  booked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- When they started playing
  started_at      TIMESTAMPTZ,
  -- When they finished playing
  finished_at     TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, player_id)
);

-- ─── MATCHES ──────────────────────────────────────────
-- Historical record of completed matches
CREATE TABLE IF NOT EXISTS matches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  court_id        UUID REFERENCES courts(id),
  match_group     INTEGER NOT NULL,
  match_format    match_format NOT NULL DEFAULT 'doubles',
  team1_score     SMALLINT DEFAULT 0,
  team2_score     SMALLINT DEFAULT 0,
  winner_team     SMALLINT CHECK (winner_team IN (1, 2)),
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  duration_minutes INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── MATCH PLAYERS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_players (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team        SMALLINT NOT NULL CHECK (team IN (1, 2)),
  is_winner   BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (match_id, player_id)
);

-- ─── REVENUE RECORDS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS revenue_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID REFERENCES sessions(id),
  booking_id      UUID REFERENCES bookings(id),
  player_id       UUID REFERENCES profiles(id),
  amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_status  payment_status NOT NULL DEFAULT 'unpaid',
  payment_method  TEXT,
  transaction_ref TEXT,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role              ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_bookings_player_id         ON bookings(player_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status            ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_date      ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_sessions_status            ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_session_date      ON sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_session_players_session_id ON session_players(session_id);
CREATE INDEX IF NOT EXISTS idx_queue_entries_session_id   ON queue_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_queue_entries_position     ON queue_entries(session_id, position);
CREATE INDEX IF NOT EXISTS idx_queue_entries_status       ON queue_entries(status);
CREATE INDEX IF NOT EXISTS idx_matches_session_id         ON matches(session_id);
CREATE INDEX IF NOT EXISTS idx_revenue_records_session_id ON revenue_records(session_id);
CREATE INDEX IF NOT EXISTS idx_revenue_records_recorded   ON revenue_records(recorded_at);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();

CREATE TRIGGER set_player_skills_updated_at
  BEFORE UPDATE ON player_skills
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();

CREATE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();

CREATE TRIGGER set_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();

CREATE TRIGGER set_queue_entries_updated_at
  BEFORE UPDATE ON queue_entries
  FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();

-- Auto-compute skill_score from individual ratings
CREATE OR REPLACE FUNCTION compute_skill_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Weighted average: serve(20%) + return(20%) + dink(25%) + volley(20%) + mobility(15%)
  -- Multiplied by tier multiplier
  DECLARE
    tier_multiplier NUMERIC := CASE NEW.skill_tier
      WHEN 'beginner'      THEN 1.0
      WHEN 'intermediate'  THEN 2.5
      WHEN 'advanced'      THEN 4.0
      WHEN 'professional'  THEN 6.0
    END;
    base_score NUMERIC;
  BEGIN
    base_score := (
      (COALESCE(NEW.serve_rating,    5) * 0.20) +
      (COALESCE(NEW.return_rating,   5) * 0.20) +
      (COALESCE(NEW.dink_rating,     5) * 0.25) +
      (COALESCE(NEW.volley_rating,   5) * 0.20) +
      (COALESCE(NEW.mobility_rating, 5) * 0.15)
    );
    NEW.skill_score := ROUND(base_score * tier_multiplier, 2);
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER compute_skill_score_trigger
  BEFORE INSERT OR UPDATE ON player_skills
  FOR EACH ROW EXECUTE PROCEDURE compute_skill_score();

-- Auto-create player_skills row when profile is created as player
CREATE OR REPLACE FUNCTION create_player_skills_on_register()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'player' THEN
    INSERT INTO player_skills (player_id)
    VALUES (NEW.id)
    ON CONFLICT (player_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_create_player_skills
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE PROCEDURE create_player_skills_on_register();

-- Update player win/loss stats after match
CREATE OR REPLACE FUNCTION update_player_stats_after_match()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.winner_team IS NOT NULL AND OLD.winner_team IS NULL THEN
    -- Update winners
    UPDATE player_skills ps
    SET total_wins = total_wins + 1,
        total_games = total_games + 1,
        current_win_streak = current_win_streak + 1
    FROM match_players mp
    WHERE mp.match_id = NEW.id
      AND mp.team = NEW.winner_team
      AND ps.player_id = mp.player_id;

    -- Update losers
    UPDATE player_skills ps
    SET total_losses = total_losses + 1,
        total_games = total_games + 1,
        current_win_streak = 0
    FROM match_players mp
    WHERE mp.match_id = NEW.id
      AND mp.team != NEW.winner_team
      AND ps.player_id = mp.player_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stats_on_match_end
  AFTER UPDATE ON matches
  FOR EACH ROW EXECUTE PROCEDURE update_player_stats_after_match();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) & HELPER FUNCTIONS
-- =====================================================

-- SECURITY DEFINER function to check owner role without triggering RLS recursion
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_skills    ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_players  ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches          ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players    ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_records  ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid duplication
DROP POLICY IF EXISTS "profiles: self read" ON profiles;
DROP POLICY IF EXISTS "profiles: self update" ON profiles;
DROP POLICY IF EXISTS "profiles: owner read all" ON profiles;

DROP POLICY IF EXISTS "skills: self read/update" ON player_skills;
DROP POLICY IF EXISTS "skills: owner read all" ON player_skills;

DROP POLICY IF EXISTS "courts: all authenticated can read" ON courts;
DROP POLICY IF EXISTS "courts: only owners modify" ON courts;

DROP POLICY IF EXISTS "bookings: player self" ON bookings;
DROP POLICY IF EXISTS "bookings: owner all" ON bookings;

DROP POLICY IF EXISTS "sessions: authenticated read" ON sessions;
DROP POLICY IF EXISTS "sessions: owner manage" ON sessions;

DROP POLICY IF EXISTS "session_players: authenticated read" ON session_players;
DROP POLICY IF EXISTS "session_players: owner manage" ON session_players;

DROP POLICY IF EXISTS "queue: authenticated read" ON queue_entries;
DROP POLICY IF EXISTS "queue: owner manage" ON queue_entries;

DROP POLICY IF EXISTS "matches: authenticated read" ON matches;
DROP POLICY IF EXISTS "matches: owner manage" ON matches;

DROP POLICY IF EXISTS "match_players: authenticated read" ON match_players;
DROP POLICY IF EXISTS "match_players: owner manage" ON match_players;

DROP POLICY IF EXISTS "revenue: owner only" ON revenue_records;

-- ── profiles ──────────────────────────────────────────
CREATE POLICY "profiles: self read"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles: self update"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles: owner read all"
  ON profiles FOR SELECT USING (is_owner());

-- ── player_skills ─────────────────────────────────────
CREATE POLICY "skills: self read/update"
  ON player_skills FOR ALL USING (auth.uid() = player_id);

CREATE POLICY "skills: owner read all"
  ON player_skills FOR SELECT USING (is_owner());

-- ── courts ────────────────────────────────────────────
CREATE POLICY "courts: all authenticated can read"
  ON courts FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "courts: only owners modify"
  ON courts FOR ALL USING (is_owner());

-- ── bookings ──────────────────────────────────────────
CREATE POLICY "bookings: player self"
  ON bookings FOR ALL USING (auth.uid() = player_id);

CREATE POLICY "bookings: owner all"
  ON bookings FOR ALL USING (is_owner());

-- ── sessions ──────────────────────────────────────────
CREATE POLICY "sessions: authenticated read"
  ON sessions FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "sessions: owner manage"
  ON sessions FOR ALL USING (is_owner());

-- ── session_players ───────────────────────────────────
CREATE POLICY "session_players: authenticated read"
  ON session_players FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "session_players: owner manage"
  ON session_players FOR ALL USING (is_owner());

-- ── queue_entries ─────────────────────────────────────
CREATE POLICY "queue: authenticated read"
  ON queue_entries FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "queue: owner manage"
  ON queue_entries FOR ALL USING (is_owner());

-- ── matches ───────────────────────────────────────────
CREATE POLICY "matches: authenticated read"
  ON matches FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "matches: owner manage"
  ON matches FOR ALL USING (is_owner());

-- ── match_players ─────────────────────────────────────
CREATE POLICY "match_players: authenticated read"
  ON match_players FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "match_players: owner manage"
  ON match_players FOR ALL USING (is_owner());

-- ── revenue_records ───────────────────────────────────
CREATE POLICY "revenue: owner only"
  ON revenue_records FOR ALL USING (is_owner());

-- =====================================================
-- REALTIME SUBSCRIPTIONS
-- Enable realtime for queue_entries so frontend gets live updates
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE queue_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
