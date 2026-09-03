-- Baseline marker.
--
-- Records that a database was created from db/schema/*.sql rather than by
-- replaying migrations. Run this once, immediately after the first successful
-- run_all.sql on a given environment; every later change gets its own file.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (filename)
VALUES ('20260902T180000_baseline.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
