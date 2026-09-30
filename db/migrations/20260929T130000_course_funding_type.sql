-- Courses are classified Grant or Non-Grant (revised requirements, and the
-- split the two CDC members answer to). Existing courses default to GRANT, the
-- aided side, which is what the seeded courses are; anything non-aided is
-- reclassified from the master data screen.

BEGIN;

DO $$ BEGIN
    CREATE TYPE course_funding_type AS ENUM ('GRANT', 'NON_GRANT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS funding_type course_funding_type NOT NULL DEFAULT 'GRANT';

COMMIT;
