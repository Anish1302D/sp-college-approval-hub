-- Row-Level Security regression test, run the way the API runs: as app_user.
--
-- WHY THIS EXISTS
-- Testing as postgres proves nothing about security — superusers bypass RLS.
-- Every defect fixed in migration 20260911T120000 passed the earlier tests
-- for exactly that reason. This file switches to app_user and sets
-- app.user_id per actor, then asserts what each person can and cannot do.
--
-- SAFE TO RUN ANYWHERE
-- Everything happens inside one transaction that is rolled back at the end,
-- so no rows survive. Requires the dev seed (db/seed/03) for its users, and
-- assumes no requests or issues already exist, since it asserts exact counts.
--
--   psql -U postgres -d spc_approval -f db/tests/rls_app_user.sql
--
-- Output: one PASS/FAIL line per check, then a summary.

\set QUIET on
\set ON_ERROR_STOP on
SET client_min_messages = notice;

BEGIN;

CREATE TEMP TABLE t_result (n SERIAL, ok BOOLEAN, label TEXT);
GRANT ALL ON t_result TO app_user;
GRANT ALL ON SEQUENCE t_result_n_seq TO app_user;

-- Stash ids in transaction-local settings so DO blocks can read them.
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT * FROM (VALUES
        ('head',      'head.cs@spcollege.edu'),
        ('incharge',  'incharge@spcollege.edu'),
        ('pc',        'pc1@spcollege.edu'),
        ('principal', 'principal@spcollege.edu'),
        ('cdc',       'cdc.grant@spcollege.edu'),
        ('chairman',  'chairman@spcollege.edu'),
        ('admin',     'admin@spcollege.edu')) AS v(k, email)
    LOOP
        PERFORM set_config('t.' || r.k,
            (SELECT user_id::TEXT FROM users WHERE email = r.email), true);
    END LOOP;
END $$;

-- Acting as someone: become app_user, then identify.
CREATE FUNCTION pg_temp.act_as(p_key TEXT) RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.user_id', current_setting('t.' || p_key), true);
END $$ LANGUAGE plpgsql;

CREATE FUNCTION pg_temp.assert_that(p_ok BOOLEAN, p_label TEXT) RETURNS VOID AS $$
BEGIN
    INSERT INTO t_result (ok, label) VALUES (COALESCE(p_ok, false), p_label);
END $$ LANGUAGE plpgsql;

-- Asserts that a statement fails with a given SQLSTATE (NULL = any error).
CREATE FUNCTION pg_temp.expect_error(p_sql TEXT, p_state TEXT, p_label TEXT) RETURNS VOID AS $$
BEGIN
    EXECUTE p_sql;
    PERFORM pg_temp.assert_that(false, p_label || ' — expected an error, statement succeeded');
EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.assert_that(p_state IS NULL OR SQLSTATE = p_state,
        p_label || CASE WHEN p_state IS NULL OR SQLSTATE = p_state THEN ''
                        ELSE ' — got ' || SQLSTATE || ': ' || SQLERRM END);
END $$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION pg_temp.act_as(TEXT), pg_temp.assert_that(BOOLEAN, TEXT),
                          pg_temp.expect_error(TEXT, TEXT, TEXT) TO app_user;

SET ROLE app_user;

-- ===========================================================================
-- Requests: creation, numbering, drafts stay private
-- ===========================================================================
DO $$
DECLARE v_fy INT; v_it INT; v_off INT; v_mic INT; v_cart INT; v_big UUID; v_draft UUID; v_small UUID;
BEGIN
    SELECT financial_year_id INTO v_fy FROM financial_years WHERE is_active;
    SELECT budget_head_id INTO v_it  FROM budget_heads WHERE code = 'IT';
    SELECT budget_head_id INTO v_off FROM budget_heads WHERE code = 'OFFICE';
    SELECT budget_item_id INTO v_mic  FROM budget_items WHERE code = 'MIC-01';
    SELECT budget_item_id INTO v_cart FROM budget_items WHERE code = 'CART-01';

    -- Head: a 6 lakh request (routes straight to CDC) and a private draft.
    PERFORM pg_temp.act_as('head');
    INSERT INTO requests (raised_by, financial_year_id, budget_head_id, title, tentative_total_cost)
    VALUES (current_setting('t.head')::UUID, v_fy, v_it, 'AV overhaul', 600000)
    RETURNING request_id INTO v_big;
    INSERT INTO request_items (request_id, budget_item_id, item_type_snapshot,
                               requested_quantity, estimated_unit_cost, estimated_total)
    VALUES (v_big, v_mic, 'CAPITAL', 4, 150000, 600000);

    INSERT INTO requests (raised_by, financial_year_id, budget_head_id, title, tentative_total_cost)
    VALUES (current_setting('t.head')::UUID, v_fy, v_off, 'Private draft', 900)
    RETURNING request_id INTO v_draft;

    -- In-charge: a 30,000 request (Purchase Committee).
    PERFORM pg_temp.act_as('incharge');
    INSERT INTO requests (raised_by, financial_year_id, budget_head_id, title, tentative_total_cost)
    VALUES (current_setting('t.incharge')::UUID, v_fy, v_off, 'Cartridges', 30000)
    RETURNING request_id INTO v_small;
    INSERT INTO request_items (request_id, budget_item_id, item_type_snapshot,
                               requested_quantity, estimated_unit_cost, estimated_total)
    VALUES (v_small, v_cart, 'CONSUMABLE', 10, 3000, 30000);

    PERFORM set_config('t.big',   v_big::TEXT,   true);
    PERFORM set_config('t.draft', v_draft::TEXT, true);
    PERFORM set_config('t.small', v_small::TEXT, true);

    PERFORM pg_temp.assert_that(
        (SELECT request_number FROM requests WHERE request_id = v_small) ~ '^REQ-\d{4}-\d{4,}$',
        'request_number generated from the sequence when omitted');

    PERFORM pg_temp.expect_error(format(
        $q$INSERT INTO requests (raised_by, financial_year_id, budget_head_id, title, tentative_total_cost)
           VALUES (%L, %s, %s, 'forged', 1)$q$, current_setting('t.head'), v_fy, v_off),
        '42501', 'cannot create a request in someone else''s name');
END $$;

-- Submit both finished requests (as their owners).
DO $$ BEGIN
    PERFORM pg_temp.act_as('head');     PERFORM fn_submit_request(current_setting('t.big')::UUID);
    PERFORM pg_temp.act_as('incharge'); PERFORM fn_submit_request(current_setting('t.small')::UUID);
END $$;

-- ===========================================================================
-- Visibility, including through views
-- ===========================================================================
DO $$ BEGIN
    PERFORM pg_temp.act_as('incharge');
    PERFORM pg_temp.assert_that((SELECT count(*) FROM requests) = 1,
        'in-charge sees only their own request');
    PERFORM pg_temp.assert_that((SELECT count(*) FROM v_pending_requests) = 1,
        'in-charge sees only their own request through v_pending_requests (view leak fixed)');
    PERFORM pg_temp.assert_that(NOT EXISTS (SELECT 1 FROM v_pending_requests
                                      WHERE request_id = current_setting('t.draft')::UUID),
        'another user''s draft is invisible through views');

    PERFORM pg_temp.act_as('principal');
    PERFORM pg_temp.assert_that(EXISTS (SELECT 1 FROM requests WHERE request_id = current_setting('t.big')::UUID),
        'principal sees a 6 lakh request that bypassed the Principal stage');
    PERFORM pg_temp.assert_that(EXISTS (SELECT 1 FROM request_items WHERE request_id = current_setting('t.big')::UUID),
        'principal sees that request''s line items');
    PERFORM pg_temp.assert_that(NOT EXISTS (SELECT 1 FROM requests WHERE request_id = current_setting('t.draft')::UUID),
        'principal does not see drafts');
    PERFORM pg_temp.assert_that((SELECT total FROM v_dashboard_by_fy) = 2,
        'principal dashboard counts both submitted requests, not the draft');

    PERFORM pg_temp.act_as('pc');
    PERFORM pg_temp.assert_that(NOT EXISTS (SELECT 1 FROM requests WHERE request_id = current_setting('t.big')::UUID),
        'purchase committee cannot see a request that never reached it');

    PERFORM pg_temp.act_as('admin');
    PERFORM pg_temp.assert_that((SELECT count(*) FROM requests) = 3,
        'admin sees everything, drafts included');
END $$;

-- ===========================================================================
-- Principal read-all must not become edit-all
-- ===========================================================================
DO $$
DECLARE v_n INT;
BEGIN
    PERFORM pg_temp.act_as('principal');
    UPDATE request_items SET estimated_unit_cost = 1 WHERE request_id = current_setting('t.big')::UUID;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    PERFORM pg_temp.assert_that(v_n = 0, 'principal cannot edit line items of a request it only reads');

    UPDATE requests SET title = 'tampered' WHERE request_id = current_setting('t.big')::UUID;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    PERFORM pg_temp.assert_that(v_n = 0, 'principal cannot edit a request it only reads');
END $$;

-- ===========================================================================
-- Approval workflow as app_user
-- ===========================================================================
DO $$ BEGIN
    -- Impersonation: Head's session passes the CDC member's id.
    PERFORM pg_temp.act_as('head');
    PERFORM pg_temp.expect_error(format(
        $q$SELECT fn_record_action(%L, %L, 'APPROVE')$q$,
        current_setting('t.big'), current_setting('t.cdc')),
        'SP013', 'requester cannot act by passing an approver''s id (SP013)');

    PERFORM pg_temp.expect_error(format(
        $q$SELECT fn_record_action(%L, %L, 'APPROVE')$q$,
        current_setting('t.big'), current_setting('t.head')),
        'SP004', 'requester cannot approve their own request (SP004)');

    PERFORM pg_temp.act_as('principal');
    PERFORM pg_temp.expect_error(format(
        $q$SELECT fn_record_action(%L, %L, 'APPROVE')$q$,
        current_setting('t.big'), current_setting('t.principal')),
        'SP004', 'principal can read a CDC request but not decide it (SP004, not "not found")');

    -- Escalation: previously rejected by RLS on every attempt.
    PERFORM pg_temp.act_as('cdc');
    PERFORM fn_record_action(current_setting('t.big')::UUID, current_setting('t.cdc')::UUID,
                             'ESCALATE', NULL, 'Grant budget unavailable');
    PERFORM pg_temp.assert_that(
        (SELECT current_status FROM requests WHERE request_id = current_setting('t.big')::UUID)
            = 'UNDER_FINAL_AUTHORITY_REVIEW',
        'CDC escalates to final authority as app_user');
    PERFORM pg_temp.assert_that(EXISTS (SELECT 1 FROM requests WHERE request_id = current_setting('t.big')::UUID),
        'CDC keeps visibility after escalating');

    PERFORM pg_temp.expect_error(format(
        $q$SELECT fn_record_action(%L, %L, 'APPROVE')$q$,
        current_setting('t.big'), current_setting('t.cdc')),
        'SP004', 'CDC cannot act once the request has moved above it');

    -- Final decision: partial approval.
    PERFORM pg_temp.act_as('chairman');
    PERFORM fn_record_action(
        current_setting('t.big')::UUID, current_setting('t.chairman')::UUID, 'PARTIAL_APPROVE',
        (SELECT jsonb_agg(jsonb_build_object('request_item_id', request_item_id,
                                             'approved_quantity', 2, 'approved_amount', 300000))
         FROM request_items WHERE request_id = current_setting('t.big')::UUID),
        'Two of four within trust ceiling');
    PERFORM pg_temp.assert_that(
        (SELECT current_status = 'PARTIALLY_APPROVED' AND sanctioned_amount = 300000
         FROM requests WHERE request_id = current_setting('t.big')::UUID),
        'chairman partially approves: PARTIALLY_APPROVED, 3,00,000 sanctioned');

    -- Purchase committee approves the small one outright.
    PERFORM pg_temp.act_as('pc');
    PERFORM fn_record_action(current_setting('t.small')::UUID, current_setting('t.pc')::UUID, 'APPROVE');
    PERFORM pg_temp.assert_that(
        (SELECT current_status FROM requests WHERE request_id = current_setting('t.small')::UUID) = 'APPROVED',
        'purchase committee approves as app_user');
END $$;

-- ===========================================================================
-- Notifications generated by trigger
-- ===========================================================================
DO $$ BEGIN
    PERFORM pg_temp.act_as('cdc');
    PERFORM pg_temp.assert_that(EXISTS (SELECT 1 FROM notifications
                                  WHERE request_id = current_setting('t.big')::UUID
                                    AND subject LIKE '%awaits your review'),
        'CDC was notified when the request arrived');

    PERFORM pg_temp.act_as('chairman');
    PERFORM pg_temp.assert_that(EXISTS (SELECT 1 FROM notifications
                                  WHERE request_id = current_setting('t.big')::UUID),
        'chairman was notified on escalation');

    PERFORM pg_temp.act_as('head');
    PERFORM pg_temp.assert_that(
        (SELECT count(*) FROM notifications WHERE request_id = current_setting('t.big')::UUID) = 2,
        'requester notified twice: escalated, then partially approved');
    PERFORM pg_temp.assert_that(NOT EXISTS (SELECT 1 FROM notifications
                                      WHERE user_id <> current_setting('t.head')::UUID),
        'requester sees only their own notifications');

    PERFORM pg_temp.expect_error(format(
        $q$INSERT INTO notifications (user_id, subject) VALUES (%L, 'spam')$q$,
        current_setting('t.cdc')), '42501', 'users still cannot write notifications for others');
END $$;

-- ===========================================================================
-- Comment visibility (design document example)
-- ===========================================================================
DO $$ BEGIN
    PERFORM pg_temp.act_as('cdc');
    INSERT INTO comments (request_id, author_user_id, stage_id, body, visibility)
    SELECT current_setting('t.big')::UUID, current_setting('t.cdc')::UUID, stage_id,
           'Grant budget is unavailable. Consider Non-Grant budget.', 'UP_CHAIN'
    FROM workflow_stages WHERE code = 'CDC';

    PERFORM pg_temp.act_as('principal');
    PERFORM pg_temp.assert_that((SELECT count(*) FROM comments) = 1,
        'UP_CHAIN CDC comment visible to the Principal');
    PERFORM pg_temp.act_as('chairman');
    PERFORM pg_temp.assert_that((SELECT count(*) FROM comments) = 1,
        'UP_CHAIN CDC comment visible to the stage above');
    PERFORM pg_temp.act_as('head');
    PERFORM pg_temp.assert_that((SELECT count(*) FROM comments) = 0,
        'UP_CHAIN CDC comment hidden from the requester');

    PERFORM pg_temp.act_as('incharge');
    PERFORM pg_temp.expect_error(format(
        $q$INSERT INTO comments (request_id, author_user_id, body) VALUES (%L, %L, 'drive-by')$q$,
        current_setting('t.big'), current_setting('t.incharge')),
        '42501', 'cannot comment on a request you cannot see');
END $$;

-- ===========================================================================
-- Attachments
-- ===========================================================================
DO $$
DECLARE v_n INT;
BEGIN
    PERFORM pg_temp.act_as('head');
    INSERT INTO attachments (request_id, file_name, storage_path, uploaded_by)
    VALUES (current_setting('t.big')::UUID, 'quote.pdf', 'x/quote.pdf', current_setting('t.head')::UUID);

    PERFORM pg_temp.act_as('principal');
    PERFORM pg_temp.assert_that((SELECT count(*) FROM attachments) = 1, 'principal can read the attachment');
    DELETE FROM attachments;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    PERFORM pg_temp.assert_that(v_n = 0, 'seeing an attachment does not allow deleting it');

    PERFORM pg_temp.act_as('incharge');
    PERFORM pg_temp.expect_error(format(
        $q$INSERT INTO attachments (request_id, file_name, storage_path, uploaded_by)
           VALUES (%L, 'x', 'x', %L)$q$, current_setting('t.big'), current_setting('t.incharge')),
        '42501', 'cannot attach to a request you cannot see');
END $$;

-- ===========================================================================
-- Non-financial issues
-- ===========================================================================
DO $$
DECLARE v_issue UUID; v_n INT;
BEGIN
    PERFORM pg_temp.act_as('head');
    INSERT INTO issues (raised_by, title, description)
    VALUES (current_setting('t.head')::UUID, 'Projector broken', 'Room 204')
    RETURNING issue_id INTO v_issue;
    PERFORM pg_temp.assert_that((SELECT issue_number FROM issues WHERE issue_id = v_issue) ~ '^ISS-\d{4,}$',
        'issue_number generated from the sequence');

    INSERT INTO attachments (issue_id, file_name, storage_path, uploaded_by)
    VALUES (v_issue, 'photo.jpg', 'x/photo.jpg', current_setting('t.head')::UUID);

    PERFORM pg_temp.act_as('principal');
    PERFORM pg_temp.assert_that(EXISTS (SELECT 1 FROM notifications WHERE issue_id = v_issue),
        'principal notified of the new issue');
    PERFORM pg_temp.assert_that(EXISTS (SELECT 1 FROM attachments WHERE issue_id = v_issue),
        'principal can read the issue''s attachment');

    UPDATE issues SET status = 'IN_REVIEW', assigned_to = current_setting('t.pc')::UUID
    WHERE issue_id = v_issue;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    PERFORM pg_temp.assert_that(v_n = 1, 'principal can review and assign an issue');

    PERFORM pg_temp.act_as('pc');
    PERFORM pg_temp.assert_that(EXISTS (SELECT 1 FROM issues WHERE issue_id = v_issue),
        'assignee can see the issue');
    PERFORM pg_temp.assert_that(EXISTS (SELECT 1 FROM notifications WHERE issue_id = v_issue),
        'assignee was notified');

    PERFORM pg_temp.act_as('incharge');
    PERFORM pg_temp.assert_that(NOT EXISTS (SELECT 1 FROM issues WHERE issue_id = v_issue),
        'unrelated user cannot see the issue');

    PERFORM pg_temp.act_as('head');
    PERFORM pg_temp.assert_that(EXISTS (SELECT 1 FROM notifications
                                  WHERE issue_id = v_issue AND subject LIKE '%in review'),
        'raiser notified of the status change');
    DELETE FROM issues WHERE issue_id = v_issue;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    PERFORM pg_temp.assert_that(v_n = 0, 'issues cannot be deleted, even by their raiser');
END $$;

-- ===========================================================================
-- Carry-forward guards
-- ===========================================================================
DO $$ BEGIN
    PERFORM pg_temp.act_as('head');
    PERFORM pg_temp.expect_error(format(
        $q$SELECT fn_carry_forward_request(%L, (SELECT financial_year_id FROM financial_years WHERE label = '2025-26'), %L)$q$,
        current_setting('t.draft'), current_setting('t.head')),
        'SP015', 'cannot carry forward into an earlier financial year (SP015)');
    PERFORM pg_temp.expect_error(format(
        $q$SELECT fn_carry_forward_request(%L, 1, %L)$q$,
        current_setting('t.draft'), current_setting('t.admin')),
        'SP013', 'carry-forward refuses a mismatched actor (SP013)');
END $$;

-- ===========================================================================
-- Fails closed with no identity
-- ===========================================================================
DO $$ BEGIN
    PERFORM set_config('app.user_id', '', true);
    PERFORM pg_temp.assert_that((SELECT count(*) FROM requests) = 0
                      AND (SELECT count(*) FROM v_pending_requests) = 0,
        'no identity set: zero rows from tables and views');
END $$;

RESET ROLE;

\set QUIET off
\pset footer off
\echo
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, label FROM t_result ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS passed, count(*) FILTER (WHERE NOT ok) AS failed, count(*) AS total
FROM t_result;

ROLLBACK;
