BEGIN;

-- Add nullable archive metadata only. Existing module, lesson, resource, and
-- progress rows/IDs/relationships remain untouched; no content is archived.
ALTER TABLE modules ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS archived_by INTEGER;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS archived_by INTEGER;

-- Install the nullable actor references idempotently. SET NULL preserves the
-- archived content if an administrator account is ever removed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'modules_archived_by_fkey'
      AND conrelid = 'modules'::regclass
  ) THEN
    ALTER TABLE modules
      ADD CONSTRAINT modules_archived_by_fkey
      FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lessons_archived_by_fkey'
      AND conrelid = 'lessons'::regclass
  ) THEN
    ALTER TABLE lessons
      ADD CONSTRAINT lessons_archived_by_fkey
      FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- Partial indexes support the student-facing active-content scans and ordering.
CREATE INDEX IF NOT EXISTS modules_active_course_position_idx
  ON modules (course_id, position, id)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS lessons_active_module_position_idx
  ON lessons (module_id, position, id)
  WHERE archived_at IS NULL;

COMMIT;

-- Rollback guidance: application rollback is safe without a database rollback;
-- leave these nullable fields and indexes in place so deployed code versions
-- can continue to read them. If a schema rollback is ever separately approved,
-- first confirm no deployed version reads archive metadata, then run manually:
--   DROP INDEX IF EXISTS lessons_active_module_position_idx;
--   DROP INDEX IF EXISTS modules_active_course_position_idx;
--   ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_archived_by_fkey;
--   ALTER TABLE modules DROP CONSTRAINT IF EXISTS modules_archived_by_fkey;
--   ALTER TABLE lessons DROP COLUMN IF EXISTS archived_by, DROP COLUMN IF EXISTS archived_at;
--   ALTER TABLE modules DROP COLUMN IF EXISTS archived_by, DROP COLUMN IF EXISTS archived_at;
-- Never use a database reset or cascade to roll this migration back.
