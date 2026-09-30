-- Brings the migration path back in line with db/schema/.
--
-- 20260927T211500 rewrote fn_record_action for the new routing rules but kept
-- the old RETURN branch, which treated a return for correction like a COMMENT:
-- the status never became AWAITING_RESUBMISSION, no correction_requests row was
-- written, any stage could return a request, and a return needed no reason. A
-- database built from db/schema/ got the corrected version; one built by
-- applying migrations did not, so on a deployed database fn_resubmit_request
-- always raised SP018 and resubmission could never happen.
--
-- 20260927T220000 created fn_resubmit_request without the p_signature_hash
-- parameter db/schema/12_functions.sql declares, so a resubmission could not be
-- sealed. Adding the parameter by CREATE OR REPLACE alone would leave two
-- overloads and make every three-argument call ambiguous, so the old one is
-- dropped first.
--
-- Both function bodies below are copied verbatim from db/schema/ so the two
-- build paths produce identical databases.

BEGIN;

-- Restated verbatim from db/schema/12_functions.sql, both so that replaying
-- the migrations over a schema build leaves every function byte-identical, and
-- for the carry-forward fix: fn_carry_forward_request copies the source's
-- current_stage_id onto the new financial year's request, so carrying forward
-- anything that had reached CDC or the final authority tripped this trigger —
-- the copy has no history of its own yet, so the Principal's decision was
-- looked for on a request that had never been decided, and SP016 made every
-- such carry-forward impossible. The Principal's decision is now looked for on
-- the request the copy came from.
CREATE OR REPLACE FUNCTION fn_enforce_stage_progression()
RETURNS TRIGGER AS $$
DECLARE
    v_principal_stage_id INTEGER;
    v_cdc_stage_id       INTEGER;
    v_final_stage_id     INTEGER;
BEGIN
    SELECT stage_id INTO v_principal_stage_id FROM workflow_stages WHERE code = 'PRINCIPAL';
    SELECT stage_id INTO v_cdc_stage_id       FROM workflow_stages WHERE code = 'CDC';
    SELECT stage_id INTO v_final_stage_id     FROM workflow_stages WHERE code = 'FINAL_AUTHORITY';

    -- Request in AWAITING_RESUBMISSION status cannot be advanced except by resubmission
    IF OLD.current_status = 'AWAITING_RESUBMISSION'
       AND NEW.current_status NOT IN ('AWAITING_RESUBMISSION', 'UNDER_PURCHASE_COMMITTEE_REVIEW', 'UNDER_PRINCIPAL_REVIEW', 'UNDER_CDC_REVIEW', 'UNDER_FINAL_AUTHORITY_REVIEW') THEN
        RAISE EXCEPTION 'Request in AWAITING_RESUBMISSION status cannot be advanced except by resubmission'
            USING ERRCODE = 'SP017';
    END IF;

    -- Cannot enter CDC or FINAL_AUTHORITY without a prior Principal approval
    -- action. A carried-forward copy inherits the stage it left off at, and
    -- its history lives on the request it came from, so that is where the
    -- Principal's decision is looked for.
    IF NEW.current_stage_id IN (v_cdc_stage_id, v_final_stage_id)
       AND (OLD.current_stage_id IS NULL OR OLD.current_stage_id <> NEW.current_stage_id) THEN
        IF NOT EXISTS (
            SELECT 1 FROM approval_actions
            WHERE request_id = COALESCE(NEW.carried_forward_from_request_id, NEW.request_id)
              AND stage_id   = v_principal_stage_id
              AND action IN ('APPROVE', 'PARTIAL_APPROVE', 'ESCALATE', 'FORWARD', 'RETURN')
        ) THEN
            RAISE EXCEPTION 'Request cannot advance to stage % without a prior Principal stage approval action',
                (SELECT code FROM workflow_stages WHERE stage_id = NEW.current_stage_id)
                USING ERRCODE = 'SP016';
        END IF;
    END IF;

    -- Cannot jump from PURCHASE_COMMITTEE directly to CDC or FINAL_AUTHORITY
    IF NEW.current_stage_id IN (v_cdc_stage_id, v_final_stage_id)
       AND OLD.current_stage_id = (SELECT stage_id FROM workflow_stages WHERE code = 'PURCHASE_COMMITTEE') THEN
        RAISE EXCEPTION 'Request cannot skip the Principal stage'
            USING ERRCODE = 'SP016';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS fn_resubmit_request(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION fn_resubmit_request(
    p_request_id     UUID,
    p_actor_id       UUID,
    p_comments       TEXT DEFAULT NULL,
    p_signature_hash TEXT DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_req           requests%ROWTYPE;
    v_new_version   INTEGER;
    v_corr_id       UUID;
    v_items_json    JSONB;
    v_target_stage  INTEGER;
    v_target_status request_status;
    v_signature_id  UUID;
BEGIN
    IF app_current_user_id() IS NOT NULL
       AND p_actor_id IS DISTINCT FROM app_current_user_id() THEN
        RAISE EXCEPTION 'Actor % does not match the authenticated user', p_actor_id
            USING ERRCODE = 'SP013';
    END IF;

    SELECT * INTO v_req FROM requests WHERE request_id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request % not found', p_request_id
            USING ERRCODE = 'SP001';
    END IF;

    IF v_req.raised_by IS DISTINCT FROM p_actor_id THEN
        RAISE EXCEPTION 'User % is not the raiser of request %', p_actor_id, v_req.request_number
            USING ERRCODE = 'SP004';
    END IF;

    IF v_req.current_status <> 'AWAITING_RESUBMISSION' THEN
        RAISE EXCEPTION 'Request % is not in AWAITING_RESUBMISSION state (current=%)',
            v_req.request_number, v_req.current_status
            USING ERRCODE = 'SP018';
    END IF;

    v_new_version := COALESCE(v_req.current_version_number, 1) + 1;

    SELECT correction_id INTO v_corr_id
    FROM correction_requests
    WHERE request_id = p_request_id AND resolved_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_corr_id IS NOT NULL THEN
        UPDATE correction_requests
           SET resolved_at = NOW(),
               resolved_by_version = v_new_version
         WHERE correction_id = v_corr_id;
    END IF;

    SELECT COALESCE(SUM(estimated_total), 0) INTO v_req.tentative_total_cost
    FROM request_items WHERE request_id = p_request_id;

    SELECT jsonb_agg(
        jsonb_build_object(
            'request_item_id', request_item_id,
            'budget_item_id', budget_item_id,
            'item_type_snapshot', item_type_snapshot,
            'requested_quantity', requested_quantity,
            'estimated_unit_cost', estimated_unit_cost,
            'estimated_total', estimated_total,
            'remarks', remarks
        )
    ) INTO v_items_json
    FROM request_items
    WHERE request_id = p_request_id;

    INSERT INTO request_versions (
        request_id, version_number, title, description,
        department_id, course_id, financial_year_id, budget_head_id,
        tentative_total_cost, extra, items_snapshot, submitted_by, correction_id
    ) VALUES (
        p_request_id, v_new_version, v_req.title, v_req.description,
        v_req.department_id, v_req.course_id, v_req.financial_year_id, v_req.budget_head_id,
        v_req.tentative_total_cost, v_req.extra, COALESCE(v_items_json, '[]'::jsonb), p_actor_id, v_corr_id
    );

    v_target_stage  := v_req.current_stage_id;
    v_target_status := fn_stage_status((SELECT code FROM workflow_stages WHERE stage_id = v_target_stage));

    UPDATE requests
       SET current_version_number = v_new_version,
           tentative_total_cost   = v_req.tentative_total_cost,
           current_status         = v_target_status,
           updated_at             = NOW()
     WHERE request_id = p_request_id;

    IF p_signature_hash IS NOT NULL THEN
        INSERT INTO digital_signatures (user_id, signed_hash)
        VALUES (p_actor_id, p_signature_hash)
        RETURNING signature_id INTO v_signature_id;
    END IF;

    INSERT INTO approval_actions (
        request_id, stage_id, performed_by, action,
        previous_status, new_status, amount_requested_snapshot, comments, signature_id
    ) VALUES (
        p_request_id, v_target_stage, p_actor_id, 'RESUBMIT',
        'AWAITING_RESUBMISSION', v_target_status, v_req.tentative_total_cost, p_comments, v_signature_id
    );

    RETURN v_new_version;
END;
$$;

CREATE OR REPLACE FUNCTION fn_record_action(
    p_request_id        UUID,
    p_actor_id          UUID,
    p_action            approval_action_type,
    p_item_decisions    JSONB DEFAULT NULL,
    p_comments          TEXT  DEFAULT NULL,
    p_rejection_reason  TEXT  DEFAULT NULL,
    p_signature_hash    TEXT  DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_req                requests%ROWTYPE;
    v_stage_code         workflow_stage_code;
    v_is_final           BOOLEAN;
    v_action_id          UUID;
    v_signature_id       UUID;
    v_new_status         request_status;
    v_new_stage          INTEGER;
    v_total              INTEGER;
    v_approved           INTEGER;
    v_rejected           INTEGER;
    v_decided            INTEGER;
    v_principal_stage_id INTEGER;
    v_cdc_stage_id       INTEGER;
    v_final_stage_id     INTEGER;
    v_cdc_count          INTEGER;
    v_final_count        INTEGER;
BEGIN
    IF app_current_user_id() IS NOT NULL
       AND p_actor_id IS DISTINCT FROM app_current_user_id() THEN
        RAISE EXCEPTION 'Actor % does not match the authenticated user', p_actor_id
            USING ERRCODE = 'SP013';
    END IF;

    SELECT * INTO v_req FROM requests WHERE request_id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        IF EXISTS (SELECT 1 FROM requests WHERE request_id = p_request_id) THEN
            RAISE EXCEPTION 'User % is not an approver at the current stage of this request', p_actor_id
                USING ERRCODE = 'SP004';
        END IF;
        RAISE EXCEPTION 'Request % not found', p_request_id
            USING ERRCODE = 'SP001';
    END IF;

    IF v_req.current_stage_id IS NULL THEN
        RAISE EXCEPTION 'Request % is not at a review stage (status = %)',
            v_req.request_number, v_req.current_status
            USING ERRCODE = 'SP002';
    END IF;

    IF v_req.current_status IN ('APPROVED','REJECTED','FULFILLED','CLOSED','CARRIED_FORWARD') THEN
        RAISE EXCEPTION 'Request % is already closed (status = %)',
            v_req.request_number, v_req.current_status
            USING ERRCODE = 'SP003';
    END IF;

    IF v_req.current_status = 'AWAITING_RESUBMISSION' THEN
        RAISE EXCEPTION 'Request % is awaiting resubmission by the requester', v_req.request_number
            USING ERRCODE = 'SP017';
    END IF;

    SELECT code, is_final INTO v_stage_code, v_is_final
    FROM workflow_stages WHERE stage_id = v_req.current_stage_id;

    SELECT stage_id INTO v_principal_stage_id FROM workflow_stages WHERE code = 'PRINCIPAL';
    SELECT stage_id INTO v_cdc_stage_id       FROM workflow_stages WHERE code = 'CDC';
    SELECT stage_id INTO v_final_stage_id     FROM workflow_stages WHERE code = 'FINAL_AUTHORITY';

    -- Authority check
    IF NOT EXISTS (
        SELECT 1 FROM stage_approvers
        WHERE stage_id = v_req.current_stage_id AND user_id = p_actor_id
    ) THEN
        RAISE EXCEPTION 'User % is not an approver at stage %', p_actor_id, v_stage_code
            USING ERRCODE = 'SP004';
    END IF;

    -- Specific Stage Restrictions
    IF v_stage_code = 'PURCHASE_COMMITTEE' AND p_action IN ('APPROVE', 'PARTIAL_APPROVE') THEN
        RAISE EXCEPTION 'Purchase Committee performs validity review only and cannot approve requests'
            USING ERRCODE = 'SP005';
    END IF;

    IF v_stage_code = 'PRINCIPAL' AND p_action IN ('APPROVE', 'PARTIAL_APPROVE') AND v_req.tentative_total_cost > 50000 THEN
        RAISE EXCEPTION 'Principal cannot final-approve requests exceeding ₹50,000'
            USING ERRCODE = 'SP005';
    END IF;

    IF p_action NOT IN ('APPROVE','PARTIAL_APPROVE','REJECT','ESCALATE','RETURN','COMMENT') THEN
        RAISE EXCEPTION 'Action % cannot be taken at a review stage', p_action
            USING ERRCODE = 'SP005';
    END IF;

    IF p_action = 'ESCALATE' AND v_is_final THEN
        RAISE EXCEPTION 'Stage % is the final authority and cannot escalate', v_stage_code
            USING ERRCODE = 'SP006';
    END IF;

    IF p_action = 'REJECT' AND COALESCE(TRIM(p_rejection_reason), '') = '' THEN
        RAISE EXCEPTION 'A rejection requires a reason'
            USING ERRCODE = 'SP007';
    END IF;

    IF p_action = 'RETURN' AND v_stage_code NOT IN ('PURCHASE_COMMITTEE', 'PRINCIPAL') THEN
        RAISE EXCEPTION 'Only Purchase Committee and Principal can return a request for correction'
            USING ERRCODE = 'SP005';
    END IF;

    IF p_action = 'RETURN' AND COALESCE(TRIM(p_comments), TRIM(p_rejection_reason), '') = '' THEN
        RAISE EXCEPTION 'A return for correction requires a reason or comments'
            USING ERRCODE = 'SP007';
    END IF;

    IF p_action = 'PARTIAL_APPROVE'
       AND (p_item_decisions IS NULL OR jsonb_array_length(p_item_decisions) = 0) THEN
        RAISE EXCEPTION 'A partial approval must specify item decisions'
            USING ERRCODE = 'SP008';
    END IF;

    IF p_signature_hash IS NOT NULL THEN
        INSERT INTO digital_signatures (user_id, signed_hash)
        VALUES (p_actor_id, p_signature_hash)
        RETURNING signature_id INTO v_signature_id;
    END IF;

    -- Determine new stage and status
    IF p_action = 'REJECT' THEN
        v_new_status := 'REJECTED';
        v_new_stage  := v_req.current_stage_id;

    ELSIF p_action = 'RETURN' THEN
        v_new_status := 'AWAITING_RESUBMISSION';
        v_new_stage  := v_req.current_stage_id;

    ELSIF p_action = 'COMMENT' THEN
        v_new_status := v_req.current_status;
        v_new_stage  := v_req.current_stage_id;

    ELSIF v_stage_code = 'PURCHASE_COMMITTEE' AND p_action = 'ESCALATE' THEN
        v_new_stage  := v_principal_stage_id;
        v_new_status := 'UNDER_PRINCIPAL_REVIEW';

    ELSIF v_stage_code = 'PRINCIPAL' AND p_action = 'ESCALATE' THEN
        IF v_req.tentative_total_cost <= 500000 THEN
            v_new_stage  := v_cdc_stage_id;
            v_new_status := 'UNDER_CDC_REVIEW';
        ELSE
            v_new_stage  := v_final_stage_id;
            v_new_status := 'UNDER_FINAL_AUTHORITY_REVIEW';
        END IF;

    ELSIF v_stage_code = 'CDC' AND p_action IN ('APPROVE', 'PARTIAL_APPROVE', 'ESCALATE') THEN
        v_new_stage  := v_cdc_stage_id;
        v_new_status := 'UNDER_CDC_REVIEW';

    ELSIF v_stage_code = 'FINAL_AUTHORITY' AND p_action IN ('APPROVE', 'PARTIAL_APPROVE') THEN
        v_new_stage  := v_final_stage_id;
        v_new_status := 'UNDER_FINAL_AUTHORITY_REVIEW';

    ELSE
        v_new_status := NULL;
        v_new_stage  := v_req.current_stage_id;
    END IF;

    INSERT INTO approval_actions (
        request_id, stage_id, performed_by, action,
        previous_status, new_status, amount_requested_snapshot,
        rejection_reason, comments, signature_id)
    VALUES (
        p_request_id, v_req.current_stage_id, p_actor_id, p_action,
        v_req.current_status, v_new_status, v_req.tentative_total_cost,
        p_rejection_reason, p_comments, v_signature_id)
    RETURNING action_id INTO v_action_id;

    IF p_action = 'RETURN' THEN
        INSERT INTO correction_requests (
            request_id, requested_by, requested_at_stage_id,
            previous_status, reason, fields_to_correct
        ) VALUES (
            p_request_id, p_actor_id, v_req.current_stage_id,
            v_req.current_status, COALESCE(p_comments, p_rejection_reason, 'Correction requested'),
            '[]'::jsonb
        );
    END IF;

    -- Item-level decisions
    IF p_item_decisions IS NOT NULL AND jsonb_array_length(p_item_decisions) > 0 THEN
        INSERT INTO approval_action_items (
            action_id, request_item_id, request_id,
            approved_quantity, approved_amount, item_decision, remarks)
        SELECT
            v_action_id, ri.request_item_id, p_request_id,
            (d->>'approved_quantity')::NUMERIC,
            (d->>'approved_amount')::NUMERIC,
            (CASE
                WHEN (d->>'approved_quantity')::NUMERIC = 0 THEN 'REJECTED'
                WHEN (d->>'approved_quantity')::NUMERIC >= ri.requested_quantity THEN 'APPROVED'
                ELSE 'PARTIALLY_APPROVED'
             END)::request_item_status,
            d->>'remarks'
        FROM jsonb_array_elements(p_item_decisions) d
        JOIN request_items ri
          ON ri.request_item_id = (d->>'request_item_id')::UUID
         AND ri.request_id      = p_request_id;

        GET DIAGNOSTICS v_decided = ROW_COUNT;
        IF v_decided <> jsonb_array_length(p_item_decisions) THEN
            RAISE EXCEPTION
                'Item decisions reference % line item(s) that do not belong to request %',
                jsonb_array_length(p_item_decisions) - v_decided, v_req.request_number
                USING ERRCODE = 'SP010';
        END IF;

        UPDATE request_items ri
           SET approved_quantity = aai.approved_quantity,
               approved_amount   = aai.approved_amount,
               item_status       = aai.item_decision,
               remarks           = COALESCE(aai.remarks, ri.remarks)
          FROM approval_action_items aai
         WHERE aai.action_id       = v_action_id
           AND aai.request_item_id = ri.request_item_id;

    ELSIF p_action = 'APPROVE' THEN
        INSERT INTO approval_action_items (
            action_id, request_item_id, request_id,
            approved_quantity, approved_amount, item_decision)
        SELECT v_action_id, ri.request_item_id, p_request_id,
               ri.requested_quantity, ri.estimated_total, 'APPROVED'
        FROM request_items ri
        WHERE ri.request_id = p_request_id;

        UPDATE request_items
           SET approved_quantity = requested_quantity,
               approved_amount   = estimated_total,
               item_status       = 'APPROVED'
         WHERE request_id = p_request_id;
    END IF;

    -- Evaluate multi-approver completion for CDC and Final Authority
    IF v_stage_code = 'CDC' AND p_action IN ('APPROVE', 'PARTIAL_APPROVE', 'ESCALATE') THEN
        SELECT COUNT(DISTINCT sa.role_id) INTO v_cdc_count
        FROM approval_actions aa
        JOIN stage_approvers sa ON sa.user_id = aa.performed_by AND sa.stage_id = v_cdc_stage_id
        JOIN roles r ON r.role_id = sa.role_id
        WHERE aa.request_id = p_request_id
          AND aa.stage_id = v_cdc_stage_id
          AND aa.action IN ('APPROVE', 'PARTIAL_APPROVE', 'ESCALATE')
          AND r.code IN ('CDC_GRANT_MEMBER', 'CDC_NON_GRANT_MEMBER');

        IF v_cdc_count >= 2 THEN
            IF v_req.tentative_total_cost <= 500000 THEN
                SELECT count(*),
                       count(*) FILTER (WHERE item_status = 'APPROVED'),
                       count(*) FILTER (WHERE item_status = 'REJECTED')
                  INTO v_total, v_approved, v_rejected
                FROM request_items WHERE request_id = p_request_id;

                v_new_status := CASE
                    WHEN v_total = 0 THEN 'APPROVED'
                    WHEN v_rejected = v_total THEN 'REJECTED'
                    WHEN v_approved = v_total THEN 'APPROVED'
                    ELSE 'PARTIALLY_APPROVED'
                END::request_status;
                v_new_stage := v_cdc_stage_id;
            ELSE
                v_new_stage := v_final_stage_id;
                v_new_status := 'UNDER_FINAL_AUTHORITY_REVIEW';
            END IF;
        ELSE
            v_new_status := 'UNDER_CDC_REVIEW';
            v_new_stage := v_cdc_stage_id;
        END IF;
        UPDATE approval_actions SET new_status = v_new_status WHERE action_id = v_action_id;

    ELSIF v_stage_code = 'FINAL_AUTHORITY' AND p_action IN ('APPROVE', 'PARTIAL_APPROVE') THEN
        SELECT COUNT(DISTINCT sa.role_id) INTO v_final_count
        FROM approval_actions aa
        JOIN stage_approvers sa ON sa.user_id = aa.performed_by AND sa.stage_id = v_final_stage_id
        JOIN roles r ON r.role_id = sa.role_id
        WHERE aa.request_id = p_request_id
          AND aa.stage_id = v_final_stage_id
          AND aa.action IN ('APPROVE', 'PARTIAL_APPROVE')
          AND r.code IN ('CHAIRMAN', 'VICE_PRESIDENT');

        IF v_final_count >= 2 THEN
            SELECT count(*),
                   count(*) FILTER (WHERE item_status = 'APPROVED'),
                   count(*) FILTER (WHERE item_status = 'REJECTED')
              INTO v_total, v_approved, v_rejected
            FROM request_items WHERE request_id = p_request_id;

            v_new_status := CASE
                WHEN v_total = 0 THEN 'APPROVED'
                WHEN v_rejected = v_total THEN 'REJECTED'
                WHEN v_approved = v_total THEN 'APPROVED'
                ELSE 'PARTIALLY_APPROVED'
            END::request_status;
            v_new_stage := v_final_stage_id;
        ELSE
            v_new_status := 'UNDER_FINAL_AUTHORITY_REVIEW';
            v_new_stage := v_final_stage_id;
        END IF;
        UPDATE approval_actions SET new_status = v_new_status WHERE action_id = v_action_id;

    ELSIF v_new_status IS NULL THEN
        SELECT count(*),
               count(*) FILTER (WHERE item_status = 'APPROVED'),
               count(*) FILTER (WHERE item_status = 'REJECTED')
          INTO v_total, v_approved, v_rejected
        FROM request_items WHERE request_id = p_request_id;

        v_new_status := CASE
            WHEN v_total = 0                              THEN 'APPROVED'
            WHEN v_rejected = v_total                     THEN 'REJECTED'
            WHEN v_approved = v_total                     THEN 'APPROVED'
            ELSE 'PARTIALLY_APPROVED'
        END::request_status;

        UPDATE approval_actions SET new_status = v_new_status WHERE action_id = v_action_id;
    END IF;

    UPDATE requests
       SET current_status   = v_new_status,
           current_stage_id = v_new_stage,
           closed_at        = CASE WHEN v_new_status IN ('REJECTED', 'APPROVED', 'PARTIALLY_APPROVED') THEN NOW() ELSE closed_at END
     WHERE request_id = p_request_id;

    IF p_action IN ('APPROVE', 'PARTIAL_APPROVE') THEN
        UPDATE approval_actions a
           SET amount_approved = r.sanctioned_amount
          FROM requests r
         WHERE a.action_id = v_action_id
           AND r.request_id = p_request_id;
    END IF;

    INSERT INTO audit_logs (entity_type, entity_id, actor_user_id, action, before_json, after_json)
    VALUES ('request', p_request_id::TEXT, p_actor_id, p_action::TEXT,
            jsonb_build_object('status', v_req.current_status, 'stage_id', v_req.current_stage_id),
            jsonb_build_object('status', v_new_status,        'stage_id', v_new_stage));

    RETURN v_action_id;
END;
$$ LANGUAGE plpgsql;

-- fn_supersede_attachment is SECURITY DEFINER and, as first written in
-- 20260927T230000, made no authorisation check at all: any signed-in user
-- could replace the quotation on any request in the college, including one
-- they could not see. Restated from db/schema/12_functions.sql with the
-- checks the attachments RLS policies would otherwise have made.
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
    v_req_status  request_status;
BEGIN
    -- SECURITY DEFINER: this function runs with the owner's rights, so RLS
    -- does not protect the rows it touches and every check has to be made
    -- here. Without them any signed-in user could replace any document on any
    -- request in the college.
    IF app_current_user_id() IS NOT NULL
       AND p_uploaded_by IS DISTINCT FROM app_current_user_id() THEN
        RAISE EXCEPTION 'Actor % does not match the authenticated user', p_uploaded_by
            USING ERRCODE = 'SP013';
    END IF;

    SELECT * INTO v_old FROM attachments WHERE attachment_id = p_old_attachment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attachment % not found', p_old_attachment_id
            USING ERRCODE = 'SP001';
    END IF;

    -- The same reach the attachments_insert policy grants.
    IF app_current_user_id() IS NOT NULL AND NOT (
        app_has_role('ADMIN')
        OR v_old.uploaded_by = app_current_user_id()
        OR (v_old.request_id IS NOT NULL AND app_can_see_request(v_old.request_id))
        OR (v_old.issue_id   IS NOT NULL AND app_can_see_issue(v_old.issue_id))
        OR (v_old.budget_provision_id IS NOT NULL AND app_has_role('HEAD') AND EXISTS (
            SELECT 1 FROM budget_provisions bp
             WHERE bp.budget_provision_id = v_old.budget_provision_id
               AND bp.department_id = (SELECT department_id FROM users WHERE user_id = app_current_user_id())
        ))
    ) THEN
        RAISE EXCEPTION 'User % may not replace attachment %', app_current_user_id(), p_old_attachment_id
            USING ERRCODE = 'SP004';
    END IF;

    IF v_old.request_id IS NOT NULL THEN
        SELECT current_version_number, current_status INTO v_req_v, v_req_status
          FROM requests WHERE request_id = v_old.request_id;

        -- Once a request is closed its documents are part of the record.
        IF v_req_status IN ('CLOSED', 'CARRIED_FORWARD') THEN
            RAISE EXCEPTION 'Request is closed; its documents cannot be replaced'
                USING ERRCODE = 'SP003';
        END IF;
    END IF;

    INSERT INTO attachments (
        request_id, issue_id, budget_provision_id, file_name, mime_type, size_bytes,
        storage_path, storage_backend, uploaded_by, version_number,
        request_version_number, replacement_reason
    ) VALUES (
        v_old.request_id, v_old.issue_id, v_old.budget_provision_id, p_file_name, p_mime_type, p_size_bytes,
        p_storage_path, COALESCE(p_storage_backend, 'local'), p_uploaded_by,
        v_old.version_number + 1, COALESCE(v_req_v, v_old.request_version_number, 1), p_replacement_reason
    ) RETURNING attachment_id INTO v_new_id;

    UPDATE attachments
       SET superseded_by_id = v_new_id
     WHERE attachment_id = p_old_attachment_id;

    RETURN v_new_id;
END;
$$;

COMMIT;
