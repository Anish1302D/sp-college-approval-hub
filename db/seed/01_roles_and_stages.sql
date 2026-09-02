-- Seed minimum viable roles and the workflow stages.
-- Amount thresholds encode the routing described in the design doc:
--   < 50,000                 -> Purchase Committee
--   50,000 - < 5,00,000      -> Principal
--   >= 5,00,000              -> CDC (and can escalate to Final Authority)

INSERT INTO roles (code, name, description) VALUES
    ('HEAD',                 'Head of Department',    'Raises requisitions'),
    ('ACTIVITY_INCHARGE',    'Activity In-charge',    'Raises requisitions'),
    ('PURCHASE_COMMITTEE',   'Purchase Committee',    'Reviews requests below 50,000'),
    ('PRINCIPAL',            'Principal',             'Approval / escalation authority'),
    ('CDC_MEMBER',           'CDC Member',            'CDC review'),
    ('CDC_GRANT_MEMBER',     'CDC Grant Member',      'Grant-side CDC authority'),
    ('CDC_NON_GRANT_MEMBER', 'CDC Non-Grant Member',  'Non-grant CDC authority'),
    ('CHAIRMAN',             'Chairman',              'Final authority'),
    ('VICE_PRESIDENT',       'Vice President',        'Final authority'),
    ('ADMIN',                'Administrator',         'System administration')
ON CONFLICT (code) DO NOTHING;

INSERT INTO workflow_stages (code, name, sequence_no, is_final) VALUES
    ('PURCHASE_COMMITTEE', 'Purchase Committee', 1, FALSE),
    ('PRINCIPAL',          'Principal',          2, FALSE),
    ('CDC',                'CDC',                3, FALSE),
    ('FINAL_AUTHORITY',    'Chairman + VP',      4, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Amount-based routing rules. NULL max_amount = no upper bound.
INSERT INTO stage_routing_rules (stage_id, min_amount, max_amount)
SELECT stage_id, 0::NUMERIC,      50000::NUMERIC  FROM workflow_stages WHERE code = 'PURCHASE_COMMITTEE'
UNION ALL
SELECT stage_id, 50000::NUMERIC,  500000::NUMERIC FROM workflow_stages WHERE code = 'PRINCIPAL'
UNION ALL
SELECT stage_id, 500000::NUMERIC, NULL::NUMERIC   FROM workflow_stages WHERE code = 'CDC';
