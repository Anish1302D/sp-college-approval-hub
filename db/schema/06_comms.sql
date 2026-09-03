-- Threaded comments (with visibility scope) and notifications.
-- Visibility rule: CDC comments shouldn't leak down to Purchase Committee / Head
-- by default; UP_CHAIN restricts to current stage and above.

CREATE TABLE comments (
    comment_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id         UUID NOT NULL REFERENCES requests(request_id) ON DELETE CASCADE,
    author_user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    stage_id           INTEGER REFERENCES workflow_stages(stage_id),
    parent_comment_id  UUID REFERENCES comments(comment_id) ON DELETE CASCADE,
    body               TEXT NOT NULL,
    visibility         comment_visibility NOT NULL DEFAULT 'ALL',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX comments_request_idx ON comments(request_id, created_at);
CREATE INDEX comments_parent_idx  ON comments(parent_comment_id);

CREATE TABLE notifications (
    notification_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    request_id       UUID REFERENCES requests(request_id) ON DELETE CASCADE,
    issue_id         UUID,                              -- FK added in 08_non_financial.sql
    channel          notification_channel NOT NULL DEFAULT 'IN_APP',
    subject          TEXT NOT NULL,
    body             TEXT,
    status           notification_status NOT NULL DEFAULT 'PENDING',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at          TIMESTAMPTZ,
    read_at          TIMESTAMPTZ
);

CREATE INDEX notifications_user_idx    ON notifications(user_id, status);
CREATE INDEX notifications_request_idx ON notifications(request_id);
