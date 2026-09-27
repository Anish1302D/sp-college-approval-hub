-- Migration: Document Versioning
-- Description: Extends attachments model with version_number, superseded_by_id, request_version_number,
--              replacement_reason, and fn_supersede_attachment helper function.

ALTER TABLE attachments ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS superseded_by_id UUID REFERENCES attachments(attachment_id) ON DELETE SET NULL;
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS request_version_number INTEGER DEFAULT 1;
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS replacement_reason TEXT;

CREATE INDEX IF NOT EXISTS attachments_superseded_idx ON attachments(superseded_by_id);

CREATE OR REPLACE FUNCTION fn_supersede_attachment(
    p_old_attachment_id   UUID,
    p_file_name           TEXT,
    p_mime_type           TEXT,
    p_size_bytes          BIGINT,
    p_storage_path        TEXT,
    p_storage_backend     TEXT,
    p_uploaded_by         UUID,
    p_replacement_reason  TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_old         attachments%ROWTYPE;
    v_new_id      UUID;
    v_req_v       INTEGER;
BEGIN
    SELECT * INTO v_old FROM attachments WHERE attachment_id = p_old_attachment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attachment % not found', p_old_attachment_id
            USING ERRCODE = 'SP001';
    END IF;

    IF v_old.request_id IS NOT NULL THEN
        SELECT current_version_number INTO v_req_v FROM requests WHERE request_id = v_old.request_id;
    END IF;

    INSERT INTO attachments (
        request_id, issue_id, file_name, mime_type, size_bytes,
        storage_path, storage_backend, uploaded_by, version_number,
        request_version_number, replacement_reason
    ) VALUES (
        v_old.request_id, v_old.issue_id, p_file_name, p_mime_type, p_size_bytes,
        p_storage_path, COALESCE(p_storage_backend, 'local'), p_uploaded_by,
        v_old.version_number + 1, COALESCE(v_req_v, v_old.request_version_number, 1), p_replacement_reason
    ) RETURNING attachment_id INTO v_new_id;

    UPDATE attachments
       SET superseded_by_id = v_new_id
     WHERE attachment_id = p_old_attachment_id;

    RETURN v_new_id;
END;
$$;
