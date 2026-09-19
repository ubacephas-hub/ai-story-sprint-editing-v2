BEGIN;

-- Additive playback aggregates. Existing lesson_progress IDs and rows remain
-- intact; defaults only affect newly added columns.
ALTER TABLE lesson_progress
  ADD COLUMN IF NOT EXISTS playback_position_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS furthest_position_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_seconds DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS watched_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS percent_complete DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_watched_at TIMESTAMPTZ;

-- Preserve the meaning of every historical completed row. We do not invent a
-- duration or watched time when the old row had no playback telemetry.
UPDATE lesson_progress
SET percent_complete = 100
WHERE status = 'completed'
  AND percent_complete < 100;

-- Admin progress queries order a student's rows by the latest watch time.
CREATE INDEX IF NOT EXISTS lesson_progress_user_last_watched_idx
  ON lesson_progress (user_id, last_watched_at DESC);

COMMIT;
