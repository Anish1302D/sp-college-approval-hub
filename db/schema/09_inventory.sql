-- Inventory + purchase bills. Linked back to the request that procured them.

CREATE TABLE purchase_bills (
    bill_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id    UUID REFERENCES requests(request_id) ON DELETE SET NULL,
    bill_number   TEXT NOT NULL,
    vendor_name   TEXT,
    bill_date     DATE,
    bill_amount   NUMERIC(14,2) NOT NULL CHECK (bill_amount >= 0),
    attachment_id UUID REFERENCES attachments(attachment_id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (bill_number, vendor_name)
);

CREATE INDEX purchase_bills_request_idx ON purchase_bills(request_id);

CREATE TABLE inventory_items (
    inventory_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_item_id   INTEGER REFERENCES budget_items(budget_item_id) ON DELETE SET NULL,
    request_id       UUID REFERENCES requests(request_id) ON DELETE SET NULL,
    bill_id          UUID REFERENCES purchase_bills(bill_id) ON DELETE SET NULL,
    department_id    INTEGER REFERENCES departments(department_id),
    name             TEXT NOT NULL,
    quantity         NUMERIC(12,2) NOT NULL CHECK (quantity >= 0),
    unit             TEXT,
    condition        TEXT,                     -- 'NEW', 'GOOD', 'DAMAGED', ...
    location         TEXT,
    acquired_on      DATE,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX inventory_items_request_idx    ON inventory_items(request_id);
CREATE INDEX inventory_items_department_idx ON inventory_items(department_id);
