BEGIN;

-- 1. Update stage_routing_rules so all requests enter at PURCHASE_COMMITTEE
UPDATE stage_routing_rules
   SET min_amount = 0,
       max_amount = NULL
 WHERE stage_id = (SELECT stage_id FROM workflow_stages WHERE code = 'PURCHASE_COMMITTEE');

DELETE FROM stage_routing_rules
 WHERE stage_id IN (SELECT stage_id FROM workflow_stages WHERE code IN ('PRINCIPAL', 'CDC'));

-- 2. Update fn_route_stage(p_amount) to always return Purchase Committee
CREATE OR REPLACE FUNCTION fn_route_stage(p_amount NUMERIC)
RETURNS INTEGER AS $$
    SELECT stage_id FROM workflow_stages WHERE code = 'PURCHASE_COMMITTEE';
$$ LANGUAGE sql STABLE;

-- 3. Database-level trigger to enforce stage progression rules
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

    -- Cannot enter CDC or FINAL_AUTHORITY without a prior Principal approval action
    IF NEW.current_stage_id IN (v_cdc_stage_id, v_final_stage_id)
       AND (OLD.current_stage_id IS NULL OR OLD.current_stage_id <> NEW.current_stage_id) THEN
        IF NOT EXISTS (
            SELECT 1 FROM approval_actions
            WHERE request_id = NEW.request_id
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

DROP TRIGGER IF EXISTS trg_enforce_stage_progression ON requests;
CREATE TRIGGER trg_enforce_stage_progression
    BEFORE INSERT OR UPDATE OF current_stage_id ON requests
    FOR EACH ROW
    EXECUTE FUNCTION fn_enforce_stage_progression();

-- 4. Update fn_record_action for PC review-only, Principal gate, CDC 2-member model, Chairman+VC joint model
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

    ELSIF p_action IN ('COMMENT','RETURN') THEN
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

-- 5. Update RLS policy requests_approver_update
DROP POLICY IF EXISTS requests_approver_update ON requests;
CREATE POLICY requests_approver_update ON requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM stage_approvers sa
            WHERE sa.user_id = app_current_user_id()
              AND sa.stage_id = requests.current_stage_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM stage_approvers sa
            JOIN workflow_stages mine   ON mine.stage_id   = sa.stage_id
            JOIN workflow_stages target ON target.stage_id = requests.current_stage_id
            WHERE sa.user_id = app_current_user_id()
              AND target.sequence_no >= mine.sequence_no
        )
        AND NOT (
            requests.current_status IN ('APPROVED', 'PARTIALLY_APPROVED')
            AND EXISTS (
                SELECT 1 FROM stage_approvers sa
                JOIN workflow_stages ws ON ws.stage_id = sa.stage_id
                WHERE sa.user_id = app_current_user_id()
                  AND ws.code = 'PURCHASE_COMMITTEE'
            )
        )
        AND NOT (
            requests.current_status IN ('APPROVED', 'PARTIALLY_APPROVED')
            AND requests.tentative_total_cost > 50000
            AND EXISTS (
                SELECT 1 FROM stage_approvers sa
                JOIN workflow_stages ws ON ws.stage_id = sa.stage_id
                WHERE sa.user_id = app_current_user_id()
                  AND ws.code = 'PRINCIPAL'
            )
        )
    );

COMMIT;
