-- Non-financial issues raised by faculty. Intentionally lightweight per the
-- requirements doc: free text + optional attachments, routed to Principal.

CREATE TABLE issues (
    issue_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_number        TEXT NOT NULL UNIQUE,      -- 'ISS-0007'
    raised_by           UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    assigned_to         UUID REFERENCES users(user_id) ON DELETE SET NULL,
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    status              issue_status NOT NULL DEFAULT 'SUBMITTED',
    escalated_at        TIMESTAMPTZ,
    escalated_to        UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ
);

CREATE INDEX issues_status_idx     ON issues(status);
CREATE INDEX issues_raised_by_idx  ON issues(raised_by);
CREATE INDEX issues_assigned_idx   ON issues(assigned_to);

CREATE TABLE issue_events (
    event_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id     UUID NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
    actor_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    action       TEXT NOT NULL,     -- 'CREATED', 'IN_REVIEW', 'ASSIGNED', 'ESCALATED', 'RESOLVED', 'COMMENT'
    note         TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX issue_events_issue_idx ON issue_events(issue_id, created_at);

-- Now that issues exists, wire up the deferred foreign keys.
ALTER TABLE notifications
    ADD CONSTRAINT notifications_issue_fk
    FOREIGN KEY (issue_id) REFERENCES issues(issue_id) ON DELETE CASCADE;

ALTER TABLE attachments
    ADD CONSTRAINT attachments_issue_fk
    FOREIGN KEY (issue_id) REFERENCES issues(issue_id) ON DELETE CASCADE;
