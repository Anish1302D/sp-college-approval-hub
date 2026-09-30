BEGIN;

ALTER TABLE attachments
    ADD COLUMN IF NOT EXISTS storage_backend TEXT;

UPDATE attachments
   SET storage_backend = CASE
       WHEN storage_path NOT LIKE '%/%' THEN 'drive'
       ELSE 'local'
   END
 WHERE storage_backend IS NULL;

ALTER TABLE attachments
    ALTER COLUMN storage_backend SET DEFAULT 'local',
    ALTER COLUMN storage_backend SET NOT NULL;

CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (filename)
VALUES ('20260927T200000_add_attachment_storage_backend.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
