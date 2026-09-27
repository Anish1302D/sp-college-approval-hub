-- Migration bookkeeping.
--
-- A database built from these schema files already contains the effect of
-- every migration listed below, because each migration's change is mirrored
-- into the schema files. Recording them here means a fresh build knows it is
-- current, and nobody has to remember to run a baseline step by hand.
--
-- When you add a migration: mirror its change into the schema files AND add
-- its filename to this list. See db/migrations/README.md.

CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (filename) VALUES
    ('20260902T180000_baseline.sql'),
    ('20260902T193000_add_sqlstate_error_codes.sql'),
    ('20260911T120000_backend_rls_fixes.sql'),
    ('20260912T090000_indian_number_format.sql'),
    ('20260927T120000_other_sentinel_items.sql'),
    ('20260927T121500_seed_courses.sql'),
    ('20260927T200000_add_attachment_storage_backend.sql')
ON CONFLICT (filename) DO NOTHING;
