-- Backend readiness: Row-Level Security fixes, numbering, notifications.
--
-- Found by running the workflow as app_user — the role the API connects as —
-- instead of as the postgres superuser, which bypasses RLS entirely and so
-- hid every one of these. Each was reproduced against a live database before
-- being fixed.
--
--   1. Views leaked every row. A view reads with its owner's privileges, and
--      the owner is the superuser. A Head querying v_pending_requests saw
--      another user's private draft. Views are now security_invoker.
--
--   2. Escalation always failed. requests_approver_update had no WITH CHECK,
--      so Postgres re-applied USING to the new row; an escalated request sits
--      at a stage the escalating approver is not staffed at. Added a WITH
--      CHECK permitting the same stage or any stage above.
--
--   3. Impersonation. fn_record_action checked the p_actor_id parameter, not
--      the session. A requester could pass an approver's id and approve their
--      own request. Now refused with SP013 when the two differ. Same guard on
--      fn_carry_forward_request, which also gains SP014 (status cannot carry
--      forward) and SP015 (target year must be later).
--
--   4. The Principal could not see requests that bypass the Principal stage —
--      anything of 5 lakh or more goes straight to CDC. Requirements give the
--      Principal read access to all college data; drafts stay private. Added
--      as SELECT-only policies, so reading everything is not editing anything.
--
--   5. UP_CHAIN comments were hidden from the Principal, the reverse of the
--      design document's own example. The Principal now sees them.
--
--   6. Comments could be inserted on any request whose id was known. Now
--      only on requests the author can see.
--
--   7. Attachments: seeing one allowed deleting it, and issue attachments were
--      invisible to everyone but the uploader. Split into read / insert /
--      delete policies; issue participants can read.
--
--   8. Issues: only the raiser could update, so the Principal could never
--      review, assign or resolve one. Split into read / insert / update.
--
--   9. No notification could be created — RLS lets users insert only their
--      own, so a submission could not notify approvers. Added SECURITY
--      DEFINER triggers that generate notifications on status changes.
--
--  10. request_number and issue_number now default from sequences, so
--      concurrent submissions cannot be handed the same number.
--
-- Safe on a database holding live data: no data is changed, only views,
-- functions, policies, sequences, defaults and triggers.

BEGIN;

-- 1. views -------------------------------------------------------------------
ALTER VIEW v_pending_requests SET (security_invoker = true);
ALTER VIEW v_pending_gt_3_days SET (security_invoker = true);
ALTER VIEW v_dashboard_by_fy SET (security_invoker = true);
ALTER VIEW v_request_timeline SET (security_invoker = true);
ALTER VIEW v_request_items_summary SET (security_invoker = true);

-- 3. actor guards ------------------------------------------------------------
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
    v_req          requests%ROWTYPE;
    v_stage_code   workflow_stage_code;
    v_is_final     BOOLEAN;
    v_next_stage   INTEGER;
    v_action_id    UUID;
    v_signature_id UUID;
    v_new_status   request_status;
    v_new_stage    INTEGER;
    v_total        INTEGER;
    v_approved     INTEGER;
    v_rejected     INTEGER;
    v_decided      INTEGER;
BEGIN
    -- The authority check below tests p_actor_id against the approver list. If
    -- that parameter could differ from the logged-in session, a requester could
    -- pass an approver's id and approve their own request — every RLS policy
    -- would pass, because they own the row. So when a session identity is set,
    -- the actor must be that identity. (No identity is set for maintenance run
    -- directly as a superuser, which RLS does not govern anyway.)
    IF app_current_user_id() IS NOT NULL
       AND p_actor_id IS DISTINCT FROM app_current_user_id() THEN
        RAISE EXCEPTION 'Actor % does not match the authenticated user', p_actor_id
            USING ERRCODE = 'SP013';
    END IF;

    -- Lock the request so two approvers acting at once can't interleave.
    SELECT * INTO v_req FROM requests WHERE request_id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        -- Under RLS, FOR UPDATE sees only rows the caller may UPDATE. A caller
        -- who can read the request but not act on it (an approver it has moved
        -- past, or the Principal reading a CDC request) lands here too. Tell
        -- them they lack authority rather than claiming the request is missing.
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

    -- Authority: the actor must be a configured approver at the current stage.
    IF NOT EXISTS (
        SELECT 1 FROM stage_approvers
        WHERE stage_id = v_req.current_stage_id AND user_id = p_actor_id
    ) THEN
        RAISE EXCEPTION 'User % is not an approver at stage %', p_actor_id, v_stage_code
            USING ERRCODE = 'SP004';
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

    -- Work out where the request lands. APPROVE / PARTIAL_APPROVE are left
    -- NULL here and resolved from the item statuses further down.
    IF p_action = 'REJECT' THEN
        v_new_status := 'REJECTED';
        v_new_stage  := v_req.current_stage_id;

    ELSIF p_action = 'ESCALATE' THEN
        v_next_stage := fn_next_stage(v_req.current_stage_id);
        IF v_next_stage IS NULL THEN
            RAISE EXCEPTION 'No stage exists above %', v_stage_code
                USING ERRCODE = 'SP009';
        END IF;
        v_new_stage  := v_next_stage;
        v_new_status := fn_stage_status(
            (SELECT code FROM workflow_stages WHERE stage_id = v_next_stage));

    ELSIF p_action IN ('COMMENT','RETURN') THEN
        v_new_status := v_req.current_status;
        v_new_stage  := v_req.current_stage_id;

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

    -- ---- item-level decisions -------------------------------------------

    IF p_item_decisions IS NOT NULL AND jsonb_array_length(p_item_decisions) > 0 THEN

        INSERT INTO approval_action_items (
            action_id, request_item_id, request_id,
            approved_quantity, approved_amount, item_decision, remarks)
        SELECT
            v_action_id,
            ri.request_item_id,
            p_request_id,
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
        -- Approve everything as requested.
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

    -- ---- resolve the request-level status --------------------------------

    IF v_new_status IS NULL THEN
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
           closed_at        = CASE WHEN v_new_status = 'REJECTED' THEN NOW() ELSE closed_at END
     WHERE request_id = p_request_id;

    -- sanctioned_amount is maintained by trigger on request_items; copy the
    -- settled figure onto the action so the timeline shows what was granted.
    -- Only decisions that actually grant money carry an amount — an escalate
    -- or a comment leaves it NULL rather than recording a misleading zero.
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

CREATE OR REPLACE FUNCTION fn_carry_forward_request(
    p_request_id   UUID,
    p_new_fy_id    INTEGER,
    p_actor_id     UUID
) RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
    v_src    requests%ROWTYPE;
BEGIN
    -- Same rule as fn_record_action: the recorded actor must be the session user.
    IF app_current_user_id() IS NOT NULL
       AND p_actor_id IS DISTINCT FROM app_current_user_id() THEN
        RAISE EXCEPTION 'Actor % does not match the authenticated user', p_actor_id
            USING ERRCODE = 'SP013';
    END IF;

    SELECT * INTO v_src FROM requests WHERE request_id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request % not found', p_request_id
            USING ERRCODE = 'SP001';
    END IF;

    -- Only unfinished work carries forward. A decided or already-moved request
    -- has nothing left to continue.
    IF v_src.current_status IN ('REJECTED','CLOSED','FULFILLED','CARRIED_FORWARD') THEN
        RAISE EXCEPTION 'Request % cannot be carried forward (status = %)',
            v_src.request_number, v_src.current_status
            USING ERRCODE = 'SP014';
    END IF;

    IF (SELECT start_date FROM financial_years WHERE financial_year_id = p_new_fy_id)
       <= (SELECT start_date FROM financial_years WHERE financial_year_id = v_src.financial_year_id) THEN
        RAISE EXCEPTION 'Target financial year must be later than the request''s current year'
            USING ERRCODE = 'SP015';
    END IF;

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

-- helpers --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_principal_can_read(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT app_has_role('PRINCIPAL')
       AND EXISTS (
            SELECT 1 FROM requests r
            WHERE r.request_id = p_request_id
              AND r.current_status <> 'DRAFT'
       );
$$;

CREATE OR REPLACE FUNCTION app_can_see_issue(p_issue_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT app_has_role('PRINCIPAL')
        OR EXISTS (
            SELECT 1 FROM issues i
            WHERE i.issue_id = p_issue_id
              AND app_current_user_id() IN (i.raised_by, i.assigned_to, i.escalated_to)
        );
$$;

-- 2, 4 requests --------------------------------------------------------------
DROP POLICY IF EXISTS requests_principal_read ON requests;
CREATE POLICY requests_principal_read ON requests
    FOR SELECT
    USING (app_has_role('PRINCIPAL') AND current_status <> 'DRAFT');

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
    );

DROP POLICY IF EXISTS request_items_principal_read ON request_items;
CREATE POLICY request_items_principal_read ON request_items
    FOR SELECT
    USING (app_principal_can_read(request_id));

DROP POLICY IF EXISTS approval_actions_principal_read ON approval_actions;
CREATE POLICY approval_actions_principal_read ON approval_actions
    FOR SELECT
    USING (app_principal_can_read(request_id));

-- 5, 6 comments --------------------------------------------------------------
DROP POLICY IF EXISTS comments_visibility ON comments;
CREATE POLICY comments_visibility ON comments
    FOR SELECT
    USING (
        app_has_role('ADMIN')
        OR author_user_id = app_current_user_id()
        OR (
            (app_can_see_request(request_id) OR app_principal_can_read(request_id))
            AND (
                visibility = 'ALL'
                OR (
                    visibility = 'UP_CHAIN'
                    AND (
                        app_has_role('PRINCIPAL')
                        OR EXISTS (
                            SELECT 1
                            FROM stage_approvers sa
                            JOIN workflow_stages viewer ON viewer.stage_id = sa.stage_id
                            JOIN workflow_stages author ON author.stage_id = comments.stage_id
                            WHERE sa.user_id = app_current_user_id()
                              AND viewer.sequence_no >= author.sequence_no
                        )
                    )
                )
                OR (
                    visibility = 'STAGE_ONLY'
                    AND EXISTS (
                        SELECT 1 FROM stage_approvers sa
                        WHERE sa.user_id = app_current_user_id()
                          AND sa.stage_id = comments.stage_id
                    )
                )
            )
        )
    );

DROP POLICY IF EXISTS comments_insert ON comments;
CREATE POLICY comments_insert ON comments
    FOR INSERT
    WITH CHECK (
        author_user_id = app_current_user_id()
        AND (
            app_has_role('ADMIN')
            OR app_can_see_request(request_id)
            OR app_principal_can_read(request_id)
        )
    );

-- 7 attachments --------------------------------------------------------------
DROP POLICY IF EXISTS attachments_via_request ON attachments;

DROP POLICY IF EXISTS attachments_read ON attachments;
CREATE POLICY attachments_read ON attachments
    FOR SELECT
    USING (
        app_has_role('ADMIN')
        OR uploaded_by = app_current_user_id()
        OR (request_id IS NOT NULL
            AND (app_can_see_request(request_id) OR app_principal_can_read(request_id)))
        OR (issue_id IS NOT NULL AND app_can_see_issue(issue_id))
    );

DROP POLICY IF EXISTS attachments_insert ON attachments;
CREATE POLICY attachments_insert ON attachments
    FOR INSERT
    WITH CHECK (
        uploaded_by = app_current_user_id()
        AND (
            app_has_role('ADMIN')
            OR (request_id IS NOT NULL AND app_can_see_request(request_id))
            OR (issue_id   IS NOT NULL AND app_can_see_issue(issue_id))
        )
    );

DROP POLICY IF EXISTS attachments_delete ON attachments;
CREATE POLICY attachments_delete ON attachments
    FOR DELETE
    USING (app_has_role('ADMIN') OR uploaded_by = app_current_user_id());

-- 8 issues -------------------------------------------------------------------
DROP POLICY IF EXISTS issues_participants ON issues;

DROP POLICY IF EXISTS issues_read ON issues;
CREATE POLICY issues_read ON issues
    FOR SELECT
    USING (
        app_has_role('ADMIN')
        OR app_has_role('PRINCIPAL')
        OR app_current_user_id() IN (raised_by, assigned_to, escalated_to)
    );

DROP POLICY IF EXISTS issues_insert ON issues;
CREATE POLICY issues_insert ON issues
    FOR INSERT
    WITH CHECK (app_has_role('ADMIN') OR raised_by = app_current_user_id());

DROP POLICY IF EXISTS issues_update ON issues;
CREATE POLICY issues_update ON issues
    FOR UPDATE
    USING (
        app_has_role('ADMIN')
        OR app_has_role('PRINCIPAL')
        OR app_current_user_id() IN (raised_by, assigned_to, escalated_to)
    )
    WITH CHECK (
        app_has_role('ADMIN')
        OR app_has_role('PRINCIPAL')
        OR app_current_user_id() IN (raised_by, assigned_to, escalated_to)
    );

-- 10 numbering ---------------------------------------------------------------
-- Human-readable numbers for requests and issues.
--
-- Generated by the database from sequences, so two people submitting at the
-- same moment can never be handed the same number. An application that
-- counted existing rows and added one would race.
--
-- Callers that supply their own number (seed data, tests, carry-forward's
-- "-CF" suffix) still can; the default applies only when the column is omitted.

CREATE SEQUENCE IF NOT EXISTS request_number_seq;
CREATE SEQUENCE IF NOT EXISTS issue_number_seq;

GRANT USAGE, SELECT ON SEQUENCE request_number_seq TO app_user;
GRANT USAGE, SELECT ON SEQUENCE issue_number_seq   TO app_user;

-- lpad() truncates a value longer than the target width, so a plain
-- lpad(n, 4) would turn request 12345 into '1234' and collide with an
-- earlier number. The width grows with the value instead.
CREATE OR REPLACE FUNCTION fn_pad_number(p_n BIGINT, p_width INT)
RETURNS TEXT AS $$
    SELECT lpad(p_n::TEXT, GREATEST(p_width, length(p_n::TEXT)), '0');
$$ LANGUAGE sql IMMUTABLE;

-- REQ-2026-0001
CREATE OR REPLACE FUNCTION fn_next_request_number()
RETURNS TEXT AS $$
    SELECT 'REQ-' || to_char(NOW(), 'YYYY') || '-' || fn_pad_number(nextval('request_number_seq'), 4);
$$ LANGUAGE sql VOLATILE;

-- ISS-0001
CREATE OR REPLACE FUNCTION fn_next_issue_number()
RETURNS TEXT AS $$
    SELECT 'ISS-' || fn_pad_number(nextval('issue_number_seq'), 4);
$$ LANGUAGE sql VOLATILE;

ALTER TABLE requests ALTER COLUMN request_number SET DEFAULT fn_next_request_number();
ALTER TABLE issues   ALTER COLUMN issue_number   SET DEFAULT fn_next_issue_number();

-- 9 notifications ------------------------------------------------------------
-- Notifications, generated by the database when a request or issue changes.
--
-- WHY TRIGGERS, AND WHY SECURITY DEFINER
-- Notifying someone means inserting a row that belongs to THEM. RLS only lets
-- a user insert their own notifications, so a requester submitting a request
-- could never notify the approvers it now waits on. These trigger functions
-- run as their owner to write those rows. They cannot be called directly —
-- a trigger function only runs when its trigger fires — so there is no way
-- to use them to send arbitrary notifications.
--
-- Recipients come from roles and stage staffing, never hard-coded addresses,
-- as the design document requires. Only in-app notifications are created;
-- delivering email is left to a worker that reads PENDING EMAIL rows.

-- ---------------------------------------------------------------------------
-- Requests
-- ---------------------------------------------------------------------------
--   enters a review stage   -> every approver staffed at that stage
--   escalated upward        -> additionally the requester, so they know
--   approved / partially approved / rejected / carried forward -> the requester

CREATE OR REPLACE FUNCTION fn_notify_request_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_stage_name TEXT;
    v_label      TEXT := lower(replace(NEW.current_status::TEXT, '_', ' '));
BEGIN
    IF left(NEW.current_status::TEXT, 6) = 'UNDER_' THEN
        SELECT name INTO v_stage_name
        FROM workflow_stages WHERE stage_id = NEW.current_stage_id;

        INSERT INTO notifications (user_id, request_id, subject, body)
        SELECT sa.user_id, NEW.request_id,
               'Request ' || NEW.request_number || ' awaits your review',
               NEW.title || ' is now with ' || v_stage_name || '.'
        FROM stage_approvers sa
        WHERE sa.stage_id = NEW.current_stage_id;

        IF left(OLD.current_status::TEXT, 6) = 'UNDER_' THEN
            INSERT INTO notifications (user_id, request_id, subject, body)
            VALUES (NEW.raised_by, NEW.request_id,
                    'Request ' || NEW.request_number || ' escalated',
                    'Forwarded to ' || v_stage_name || ' for review.');
        END IF;

    ELSIF NEW.current_status IN ('APPROVED','PARTIALLY_APPROVED','REJECTED','CARRIED_FORWARD') THEN
        INSERT INTO notifications (user_id, request_id, subject, body)
        VALUES (NEW.raised_by, NEW.request_id,
                'Request ' || NEW.request_number || ' ' || v_label,
                CASE
                    WHEN NEW.current_status IN ('APPROVED','PARTIALLY_APPROVED')
                        THEN 'Sanctioned amount: ' || COALESCE(NEW.sanctioned_amount, 0)::TEXT
                             || ' of ' || NEW.tentative_total_cost::TEXT || ' requested.'
                    ELSE NEW.title
                END);
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS requests_notify_status ON requests;
CREATE TRIGGER requests_notify_status
    AFTER UPDATE OF current_status ON requests
    FOR EACH ROW
    WHEN (OLD.current_status IS DISTINCT FROM NEW.current_status)
    EXECUTE FUNCTION fn_notify_request_status();

-- ---------------------------------------------------------------------------
-- Non-financial issues
-- ---------------------------------------------------------------------------
--   raised              -> every Principal
--   status changes      -> the raiser
--   assigned            -> the new assignee
--   escalated to someone -> that person

CREATE OR REPLACE FUNCTION fn_notify_issue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO notifications (user_id, issue_id, subject, body)
        SELECT ur.user_id, NEW.issue_id,
               'New issue ' || NEW.issue_number, NEW.title
        FROM user_roles ur
        JOIN roles r ON r.role_id = ur.role_id
        WHERE r.code = 'PRINCIPAL'
          AND ur.user_id <> NEW.raised_by;
        RETURN NULL;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO notifications (user_id, issue_id, subject, body)
        VALUES (NEW.raised_by, NEW.issue_id,
                'Issue ' || NEW.issue_number || ' is now '
                    || lower(replace(NEW.status::TEXT, '_', ' ')),
                NEW.title);
    END IF;

    IF NEW.assigned_to IS NOT NULL
       AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
        INSERT INTO notifications (user_id, issue_id, subject, body)
        VALUES (NEW.assigned_to, NEW.issue_id,
                'Issue ' || NEW.issue_number || ' assigned to you', NEW.title);
    END IF;

    IF NEW.escalated_to IS NOT NULL
       AND NEW.escalated_to IS DISTINCT FROM OLD.escalated_to THEN
        INSERT INTO notifications (user_id, issue_id, subject, body)
        VALUES (NEW.escalated_to, NEW.issue_id,
                'Issue ' || NEW.issue_number || ' escalated to you', NEW.title);
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS issues_notify_insert ON issues;
CREATE TRIGGER issues_notify_insert
    AFTER INSERT ON issues
    FOR EACH ROW
    EXECUTE FUNCTION fn_notify_issue();

DROP TRIGGER IF EXISTS issues_notify_update ON issues;
CREATE TRIGGER issues_notify_update
    AFTER UPDATE OF status, assigned_to, escalated_to ON issues
    FOR EACH ROW
    EXECUTE FUNCTION fn_notify_issue();

-- Databases built before 17_schema_migrations.sql existed may lack the table.
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (filename)
VALUES ('20260911T120000_backend_rls_fixes.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
