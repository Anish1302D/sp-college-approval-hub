-- Migration: add sentinel "Other (specify)" rows to budget_heads and budget_items
-- so the NewRequestModal can offer an "Other" option on every dropdown
-- without a schema change.
--
-- These rows are permanent reference data, not seed-only data. They must be
-- present in production for the "Other" UI path to work.
--
-- HOW IT WORKS
-- When a requester picks "Other" on the Budget Head dropdown the form sends
-- budget_head_id pointing at the 'OTHER' head and stores the typed name in
-- extra->>'customBudgetHead'. When they pick "Other" on a budget item line
-- the form sends the sentinel item id for that head's 'OTHER' item and stores
-- the typed name in the line's remarks field. The frontend displays the
-- remarks value as the item name whenever code = 'OTHER'.

-- Add the catch-all budget head (idempotent).
INSERT INTO budget_heads (code, name, head_type, description, is_active)
VALUES ('OTHER', 'Other (specify)', 'REVENUE', 'Catch-all head for items that do not fit an existing category', TRUE)
ON CONFLICT (code) DO NOTHING;

-- Add one sentinel item under EVERY budget head (including the new OTHER head).
-- A requester sees only items belonging to their chosen head, so each head
-- needs its own sentinel row.
INSERT INTO budget_items (budget_head_id, code, name, item_type, unit, is_active)
SELECT bh.budget_head_id,
       'OTHER',
       'Other (specify)',
       'CONSUMABLE',
       NULL,
       TRUE
FROM budget_heads bh
ON CONFLICT (budget_head_id, code) DO NOTHING;
