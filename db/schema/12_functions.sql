-- Helper functions the app can call so complex writes are one round-trip
-- and stay consistent even if two users act concurrently.

-- Picks the workflow stage a request should enter, based on total amount.
CREATE OR REPLACE FUNCTION fn_route_stage(p_amount NUMERIC)
RETURNS INTEGER AS $$
    SELECT srr.stage_id
    FROM stage_routing_rules srr
    WHERE srr.min_amount <= p_amount
      AND (srr.max_amount IS NULL OR p_amount < srr.max_amount)
    ORDER BY srr.min_amount DESC
    LIMIT 1;
$$ LANGUAGE sql STABLE;

-- The "sitting at this stage" status for a given stage. Used by both
-- fn_submit_request and fn_record_action so the mapping lives in one place.
CREATE OR REPLACE FUNCTION fn_stage_status(p_code workflow_stage_code)
RETURNS request_status AS $$
    SELECT (CASE p_code
        WHEN 'PURCHASE_COMMITTEE' THEN 'UNDER_PURCHASE_COMMITTEE_REVIEW'
        WHEN 'PRINCIPAL'          THEN 'UNDER_PRINCIPAL_REVIEW'
        WHEN 'CDC'                THEN 'UNDER_CDC_REVIEW'
        WHEN 'FINAL_AUTHORITY'    THEN 'UNDER_FINAL_AUTHORITY_REVIEW'
    END)::request_status;
$$ LANGUAGE sql IMMUTABLE;

-- The stage directly above a given stage, or NULL if it is the top.
CREATE OR REPLACE FUNCTION fn_next_stage(p_stage_id INTEGER)
RETURNS INTEGER AS $$
    SELECT ws.stage_id
    FROM workflow_stages ws
    WHERE ws.sequence_no > (SELECT sequence_no FROM workflow_stages WHERE stage_id = p_stage_id)
    ORDER BY ws.sequence_no
    LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Moves a DRAFT request into the correct entry stage and stamps submitted_at.
CREATE OR REPLACE FUNCTION fn_submit_request(p_request_id UUID)
RETURNS VOID AS $$
DECLARE
    v_amount NUMERIC(14,2);
    v_stage  INTEGER;
    v_status request_status;
BEGIN
    SELECT tentative_total_cost, current_status
      INTO v_amount, v_status
    FROM requests
    WHERE request_id = p_request_id
    FOR UPDATE;

    IF v_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'Request % is not in DRAFT state (current=%)', p_request_id, v_status
            USING ERRCODE = 'SP011';
    END IF;

    v_stage := fn_route_stage(v_amount);
    IF v_stage IS NULL THEN
        RAISE EXCEPTION 'No routing rule matches amount %', v_amount
            USING ERRCODE = 'SP012';
    END IF;

    UPDATE requests
       SET current_status   = fn_stage_status((SELECT code FROM workflow_stages WHERE stage_id = v_stage)),
           current_stage_id = v_stage,
           submitted_at     = COALESCE(submitted_at, NOW())
     WHERE request_id = p_request_id;

    INSERT INTO approval_actions (request_id, stage_id, performed_by, action,
                                  previous_status, new_status,
                                  amount_requested_snapshot)
    SELECT p_request_id, v_stage, raised_by, 'SUBMIT',
           'DRAFT', current_status, tentative_total_cost
    FROM requests WHERE request_id = p_request_id;
END;
$$ LANGUAGE plpgsql;

-- Carries an unfinished request into the next financial year, preserving
-- the original row and pointing back to it. Nothing is overwritten.
CREATE OR REPLACE FUNCTION fn_carry_forward_request(
    p_request_id   UUID,
    p_new_fy_id    INTEGER,
    p_actor_id     UUID
) RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
BEGIN
    INSERT INTO requests (
        request_number, raised_by, department_id, course_id,
        financial_year_id, budget_head_id, title, description,
        tentative_total_cost, current_status, current_stage_id,
        extra,
        carried_forward_from_request_id, carried_forward_from_fy_id
    )
    SELECT
        r.request_number || '-CF',
        r.raised_by, r.department_id, r.course_id,
        p_new_fy_id, r.budget_head_id, r.title, r.description,
        r.tentative_total_cost, r.current_status, r.current_stage_id,
        r.extra,
        r.request_id, r.financial_year_id
    FROM requests r WHERE r.request_id = p_request_id
    RETURNING request_id INTO v_new_id;

    -- Copy line items so they're editable in the new context.
    INSERT INTO request_items (
        request_id, budget_item_id, item_type_snapshot,
        requested_quantity, estimated_unit_cost, estimated_total,
        approved_quantity, approved_amount, item_status, remarks
    )
    SELECT v_new_id, budget_item_id, item_type_snapshot,
           requested_quantity, estimated_unit_cost, estimated_total,
           approved_quantity, approved_amount, item_status, remarks
    FROM request_items WHERE request_id = p_request_id;

    -- Mark the original as CARRIED_FORWARD.
    UPDATE requests
       SET current_status = 'CARRIED_FORWARD',
           closed_at      = NOW()
     WHERE request_id = p_request_id;

    INSERT INTO approval_actions (request_id, performed_by, action,
                                  previous_status, new_status,
                                  comments)
    VALUES (p_request_id, p_actor_id, 'CARRY_FORWARD',
            (SELECT current_status FROM requests WHERE request_id = v_new_id),
            'CARRIED_FORWARD',
            'Carried forward to request ' || v_new_id::text);

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;
