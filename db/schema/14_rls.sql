-- Row-Level Security.
--
-- HOW THIS WORKS
-- The application connects as the `app_user` role and, at the start of every
-- request, tells Postgres who the logged-in person is:
--
--     SET LOCAL app.user_id = '<uuid of the authenticated user>';
--
-- Use SET LOCAL (transaction-scoped), never plain SET, or the value leaks to
-- the next request that reuses the pooled connection.
--
-- IMPORTANT: superusers and table owners bypass RLS. Connecting as `postgres`
-- sees everything regardless of the policies below — that is expected, and is
-- why the app must not use the postgres role.

-- ---------------------------------------------------------------------------
-- Application role
-- ---------------------------------------------------------------------------
-- Created without LOGIN deliberately: choose a password yourself rather than
-- having one committed to the repository.
--
--     ALTER ROLE app_user LOGIN PASSWORD '<your password>';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user NOLOGIN;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- WHY THESE ARE SECURITY DEFINER
-- A policy expression is itself subject to RLS. A helper that reads `requests`
-- or `approval_actions` while those tables' own policies call that same helper
-- recurses until the stack blows. SECURITY DEFINER makes these helpers read as
-- the (RLS-exempt) owner, which breaks the cycle. search_path is pinned so the
-- elevated body cannot be redirected at a shadowed table.
--
-- Each returns only a boolean, so nothing leaks beyond a visibility yes/no.

CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS UUID AS $$
    SELECT NULLIF(current_setting('app.user_id', true), '')::UUID;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_has_role(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON r.role_id = ur.role_id
        WHERE ur.user_id = app_current_user_id()
          AND r.code = p_code
    );
$$;

-- True when the user is a configured approver on a stage this request sits at
-- now, or passed through earlier (so approvers keep visibility after escalating).
CREATE OR REPLACE FUNCTION app_is_stage_participant(p_request_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM requests r
        JOIN stage_approvers sa ON sa.user_id = p_user_id
        WHERE r.request_id = p_request_id
          AND (
                sa.stage_id = r.current_stage_id
             OR EXISTS (
                    SELECT 1 FROM approval_actions aa
                    WHERE aa.request_id = r.request_id
                      AND aa.stage_id   = sa.stage_id
                )
          )
    );
$$;

CREATE OR REPLACE FUNCTION app_can_see_request(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        EXISTS (
            SELECT 1 FROM requests r
            WHERE r.request_id = p_request_id
              AND r.raised_by  = app_current_user_id()
        )
        OR app_is_stage_participant(p_request_id, app_current_user_id());
$$;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
-- Multiple permissive policies on a table are OR-ed together.

ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY requests_admin ON requests
    USING (app_has_role('ADMIN'))
    WITH CHECK (app_has_role('ADMIN'));

-- A requester sees and edits their own requests.
CREATE POLICY requests_own ON requests
    USING (raised_by = app_current_user_id())
    WITH CHECK (raised_by = app_current_user_id());

-- Approvers see requests currently at their stage, or that passed through it.
CREATE POLICY requests_approver ON requests
    FOR SELECT
    USING (app_is_stage_participant(request_id, app_current_user_id()));

-- Approvers act through fn_record_action, which updates the request row.
CREATE POLICY requests_approver_update ON requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM stage_approvers sa
            WHERE sa.user_id = app_current_user_id()
              AND sa.stage_id = requests.current_stage_id
        )
    );

-- Line items follow their parent request.
ALTER TABLE request_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY request_items_via_request ON request_items
    USING (app_has_role('ADMIN') OR app_can_see_request(request_id))
    WITH CHECK (app_has_role('ADMIN') OR app_can_see_request(request_id));

-- The audit trail follows the request too.
ALTER TABLE approval_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY approval_actions_via_request ON approval_actions
    USING (app_has_role('ADMIN') OR app_can_see_request(request_id))
    WITH CHECK (app_has_role('ADMIN') OR app_can_see_request(request_id));

-- Comment visibility — the hierarchical rule from the design doc.
--   ALL         visible to anyone who can see the request
--   UP_CHAIN    visible to the authoring stage and every stage above it
--   STAGE_ONLY  visible only to approvers on the authoring stage
-- The author always sees their own comment.
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY comments_visibility ON comments
    FOR SELECT
    USING (
        app_has_role('ADMIN')
        OR author_user_id = app_current_user_id()
        OR (
            app_can_see_request(request_id)
            AND (
                visibility = 'ALL'
                OR (
                    visibility = 'UP_CHAIN'
                    AND EXISTS (
                        SELECT 1
                        FROM stage_approvers sa
                        JOIN workflow_stages viewer ON viewer.stage_id = sa.stage_id
                        JOIN workflow_stages author ON author.stage_id = comments.stage_id
                        WHERE sa.user_id = app_current_user_id()
                          AND viewer.sequence_no >= author.sequence_no
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

CREATE POLICY comments_insert ON comments
    FOR INSERT
    WITH CHECK (author_user_id = app_current_user_id());

-- People see only their own notifications.
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_own ON notifications
    USING (app_has_role('ADMIN') OR user_id = app_current_user_id())
    WITH CHECK (app_has_role('ADMIN') OR user_id = app_current_user_id());

-- Attachments follow their request.
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY attachments_via_request ON attachments
    USING (
        app_has_role('ADMIN')
        OR uploaded_by = app_current_user_id()
        OR (request_id IS NOT NULL AND app_can_see_request(request_id))
    )
    WITH CHECK (
        app_has_role('ADMIN')
        OR uploaded_by = app_current_user_id()
    );

-- Non-financial issues: raiser, assignee, escalation target, Principal, Admin.
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY issues_participants ON issues
    USING (
        app_has_role('ADMIN')
        OR app_has_role('PRINCIPAL')
        OR raised_by   = app_current_user_id()
        OR assigned_to = app_current_user_id()
        OR escalated_to = app_current_user_id()
    )
    WITH CHECK (
        app_has_role('ADMIN')
        OR raised_by = app_current_user_id()
    );

-- The audit log is append-only for everyone; only Admin reads it back.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_admin_read ON audit_logs
    FOR SELECT USING (app_has_role('ADMIN'));

CREATE POLICY audit_logs_insert ON audit_logs
    FOR INSERT WITH CHECK (true);
