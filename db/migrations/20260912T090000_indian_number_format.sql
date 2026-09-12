-- Indian number formatting in notifications.
--
-- Notifications announced amounts as raw numbers ("Sanctioned amount:
-- 300000.00 of 650000.00 requested"). fn_inr writes them the way the college
-- does, grouping the last three digits and then twos, which to_char cannot do.
-- The email templates will need the same function.

BEGIN;

CREATE OR REPLACE FUNCTION fn_inr(p_amount NUMERIC)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_sign TEXT := CASE WHEN p_amount < 0 THEN '-' ELSE '' END;
    v_text TEXT := to_char(round(abs(COALESCE(p_amount, 0)), 2), 'FM9999999999990.00');
    v_int  TEXT := split_part(v_text, '.', 1);
    v_frac TEXT := split_part(v_text, '.', 2);
    v_head TEXT;
BEGIN
    IF length(v_int) <= 3 THEN
        RETURN v_sign || '₹' || v_int || '.' || v_frac;
    END IF;
    -- Group everything before the final three digits in pairs, right to left.
    v_head := reverse(regexp_replace(reverse(left(v_int, length(v_int) - 3)),
                                     '(\d{2})(?=\d)', '\1,', 'g'));
    RETURN v_sign || '₹' || v_head || ',' || right(v_int, 3) || '.' || v_frac;
END;
$$;

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
                        THEN 'Sanctioned ' || fn_inr(COALESCE(NEW.sanctioned_amount, 0))
                             || ' of ' || fn_inr(NEW.tentative_total_cost) || ' requested.'
                    ELSE NEW.title
                END);
    END IF;

    RETURN NULL;
END;
$$;

CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (filename)
VALUES ('20260912T090000_indian_number_format.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
