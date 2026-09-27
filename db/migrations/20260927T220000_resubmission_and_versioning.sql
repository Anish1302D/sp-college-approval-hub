-- Migration: Amount Routing & CDC Joint Decision & Resubmission Versioning
-- Description: Adds resubmission versioning tables, correction_requests, AWAITING_RESUBMISSION status,
--              RESUBMIT action type, fn_resubmit_request, and RLS policies.

ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'AWAITING_RESUBMISSION';
ALTER TYPE approval_action_type ADD VALUE IF NOT EXISTS 'RESUBMIT';

CREATE TABLE IF NOT EXISTS correction_requests (
    correction_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id               UUID NOT NULL REFERENCES requests(request_id) ON DELETE CASCADE,
    requested_by             UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    requested_at_stage_id    INTEGER NOT NULL REFERENCES workflow_stages(stage_id),
    previous_status          request_status NOT NULL,
    reason                   TEXT NOT NULL,
    fields_to_correct        JSONB DEFAULT '[]'::jsonb,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at              TIMESTAMPTZ,
    resolved_by_version      INTEGER
);

CREATE INDEX IF NOT EXISTS correction_requests_request_idx ON correction_requests(request_id);

ALTER TABLE requests ADD COLUMN IF NOT EXISTS current_version_number INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS request_versions (
    version_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id              UUID NOT NULL REFERENCES requests(request_id) ON DELETE CASCADE,
    version_number          INTEGER NOT NULL,
    title                   TEXT NOT NULL,
    description             TEXT,
    department_id           INTEGER REFERENCES departments(department_id),
    course_id               INTEGER REFERENCES courses(course_id),
    financial_year_id       INTEGER NOT NULL REFERENCES financial_years(financial_year_id),
    budget_head_id          INTEGER NOT NULL REFERENCES budget_heads(budget_head_id),
    tentative_total_cost    NUMERIC(14,2) NOT NULL,
    extra                   JSONB NOT NULL DEFAULT '{}'::jsonb,
    items_snapshot          JSONB NOT NULL,
    submitted_by            UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    submitted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    correction_id           UUID REFERENCES correction_requests(correction_id),
    UNIQUE(request_id, version_number)
);

CREATE INDEX IF NOT EXISTS request_versions_request_idx ON request_versions(request_id, version_number);

CREATE OR REPLACE FUNCTION fn_submit_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_amount NUMERIC(14,2);
    v_stage  INTEGER;
    v_status request_status;
    v_req    requests%ROWTYPE;
    v_items_json JSONB;
BEGIN
    SELECT * INTO v_req
    FROM requests
    WHERE request_id = p_request_id
    FOR UPDATE;

    IF v_req.request_id IS NULL THEN
        RAISE EXCEPTION 'Request % not found', p_request_id
            USING ERRCODE = 'SP001';
    END IF;

    IF v_req.current_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'Request % is not in DRAFT state (current=%)', p_request_id, v_req.current_status
            USING ERRCODE = 'SP011';
    END IF;

    v_amount := v_req.tentative_total_cost;
    v_stage := fn_route_stage(v_amount);
    IF v_stage IS NULL THEN
        RAISE EXCEPTION 'No routing rule matches amount %', v_amount
            USING ERRCODE = 'SP012';
    END IF;

    v_status := fn_stage_status((SELECT code FROM workflow_stages WHERE stage_id = v_stage));

    UPDATE requests
       SET current_status   = v_status,
           current_stage_id = v_stage,
           current_version_number = 1,
           submitted_at     = COALESCE(submitted_at, NOW())
     WHERE request_id = p_request_id;

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
        tentative_total_cost, extra, items_snapshot, submitted_by
    ) VALUES (
        p_request_id, 1, v_req.title, v_req.description,
        v_req.department_id, v_req.course_id, v_req.financial_year_id, v_req.budget_head_id,
        v_req.tentative_total_cost, v_req.extra, COALESCE(v_items_json, '[]'::jsonb), v_req.raised_by
    )
    ON CONFLICT (request_id, version_number) DO NOTHING;

    INSERT INTO approval_actions (request_id, stage_id, performed_by, action,
                                  previous_status, new_status,
                                  amount_requested_snapshot)
    SELECT p_request_id, v_stage, raised_by, 'SUBMIT',
           'DRAFT', v_status, tentative_total_cost
    FROM requests WHERE request_id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_resubmit_request(
    p_request_id UUID,
    p_actor_id   UUID,
    p_comments   TEXT DEFAULT NULL
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

    INSERT INTO approval_actions (
        request_id, stage_id, performed_by, action,
        previous_status, new_status, amount_requested_snapshot, comments
    ) VALUES (
        p_request_id, v_target_stage, p_actor_id, 'RESUBMIT',
        'AWAITING_RESUBMISSION', v_target_status, v_req.tentative_total_cost, p_comments
    );

    RETURN v_new_version;
END;
$$;

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

    IF OLD.current_status = 'AWAITING_RESUBMISSION'
       AND NEW.current_status NOT IN ('AWAITING_RESUBMISSION', 'UNDER_PURCHASE_COMMITTEE_REVIEW', 'UNDER_PRINCIPAL_REVIEW', 'UNDER_CDC_REVIEW', 'UNDER_FINAL_AUTHORITY_REVIEW') THEN
        RAISE EXCEPTION 'Request in AWAITING_RESUBMISSION status cannot be advanced except by resubmission'
            USING ERRCODE = 'SP017';
    END IF;

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

    IF NEW.current_stage_id IN (v_cdc_stage_id, v_final_stage_id)
       AND OLD.current_stage_id = (SELECT stage_id FROM workflow_stages WHERE code = 'PURCHASE_COMMITTEE') THEN
        RAISE EXCEPTION 'Request cannot skip the Principal stage'
            USING ERRCODE = 'SP016';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE correction_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY correction_requests_read ON correction_requests
        FOR SELECT
        USING (
            app_has_role('ADMIN')
            OR app_can_see_request(request_id)
            OR app_principal_can_read(request_id)
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY correction_requests_insert ON correction_requests
        FOR INSERT
        WITH CHECK (
            app_has_role('ADMIN')
            OR app_can_see_request(request_id)
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY correction_requests_update ON correction_requests
        FOR UPDATE
        USING (
            app_has_role('ADMIN')
            OR app_can_see_request(request_id)
            OR app_principal_can_read(request_id)
        )
        WITH CHECK (
            app_has_role('ADMIN')
            OR app_can_see_request(request_id)
            OR app_principal_can_read(request_id)
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE request_versions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY request_versions_read ON request_versions
        FOR SELECT
        USING (
            app_has_role('ADMIN')
            OR app_can_see_request(request_id)
            OR app_principal_can_read(request_id)
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY request_versions_insert ON request_versions
        FOR INSERT
        WITH CHECK (
            app_has_role('ADMIN')
            OR app_can_see_request(request_id)
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
DECLARE
    r RECORD;
    v_items JSONB;
BEGIN
    FOR r IN SELECT * FROM requests WHERE submitted_at IS NOT NULL LOOP
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
        ) INTO v_items
        FROM request_items
        WHERE request_id = r.request_id;

        INSERT INTO request_versions (
            request_id, version_number, title, description,
            department_id, course_id, financial_year_id, budget_head_id,
            tentative_total_cost, extra, items_snapshot, submitted_by, submitted_at
        ) VALUES (
            r.request_id, 1, r.title, r.description,
            r.department_id, r.course_id, r.financial_year_id, r.budget_head_id,
            r.tentative_total_cost, r.extra, COALESCE(v_items, '[]'::jsonb), r.raised_by, r.submitted_at
        ) ON CONFLICT (request_id, version_number) DO NOTHING;
    END LOOP;
END $$;
