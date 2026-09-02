-- A minimal set of departments, financial years, and budgets so the app
-- has something to render against. Safe to run repeatedly.

INSERT INTO departments (code, name) VALUES
    ('CS',   'Computer Science'),
    ('CHEM', 'Chemistry'),
    ('PHY',  'Physics'),
    ('ADMIN','Administration')
ON CONFLICT (code) DO NOTHING;

INSERT INTO financial_years (label, start_date, end_date, is_active) VALUES
    ('2025-26', DATE '2025-04-01', DATE '2026-03-31', FALSE),
    ('2026-27', DATE '2026-04-01', DATE '2027-03-31', TRUE)
ON CONFLICT (label) DO NOTHING;

INSERT INTO budget_heads (code, name, head_type, description) VALUES
    ('LAB',    'Laboratory',         'CAPITAL', 'Lab equipment and supplies'),
    ('INFRA',  'Infrastructure',     'CAPITAL', 'Buildings and fixed assets'),
    ('IT',     'IT Equipment',       'CAPITAL', 'Computers, network, AV gear'),
    ('OFFICE', 'Office Expenses',    'REVENUE', 'Stationery, printing, utilities'),
    ('ACAD',   'Academic Activities','REVENUE', 'Seminars, workshops, teaching aids'),
    ('MAINT',  'Maintenance',        'REVENUE', 'Repairs and servicing'),
    ('STU',    'Student Activities', 'REVENUE', 'Events, clubs, competitions')
ON CONFLICT (code) DO NOTHING;

-- Sample budget items under a few heads.
INSERT INTO budget_items (budget_head_id, code, name, item_type, unit)
SELECT bh.budget_head_id, v.code, v.name, v.item_type::budget_item_type, v.unit
FROM (VALUES
    ('LAB',    'GLASS-01',  'Chemistry Glassware',      'CONSUMABLE', 'piece'),
    ('LAB',    'CHEM-01',   'Lab Chemicals',            'CONSUMABLE', 'litre'),
    ('IT',     'MIC-01',    'Wireless Microphone',      'CAPITAL',    'piece'),
    ('IT',     'SPK-01',    'Speaker',                  'CAPITAL',    'piece'),
    ('IT',     'HDMI-01',   'HDMI Cable',               'CONSUMABLE', 'piece'),
    ('IT',     'TRI-01',    'Tripod',                   'CAPITAL',    'piece'),
    ('OFFICE', 'CART-01',   'Printer Cartridge',        'CONSUMABLE', 'piece'),
    ('OFFICE', 'PAPER-01',  'A4 Paper Ream',            'CONSUMABLE', 'ream')
) AS v(head_code, code, name, item_type, unit)
JOIN budget_heads bh ON bh.code = v.head_code
ON CONFLICT (budget_head_id, code) DO NOTHING;
