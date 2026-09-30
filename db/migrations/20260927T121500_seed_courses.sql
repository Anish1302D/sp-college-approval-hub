-- Migration: seed courses for the four departments that ship with the app.
-- This is the fix for the "Courses always disabled" bug: the courses table
-- exists and the API works, but no rows were ever inserted.
-- Safe to run multiple times (ON CONFLICT DO NOTHING).

INSERT INTO courses (department_id, code, name)
SELECT d.department_id, v.code, v.name
FROM (VALUES
    -- Computer Science
    ('CS', 'BCA',    'Bachelor of Computer Applications'),
    ('CS', 'MCA',    'Master of Computer Applications'),
    ('CS', 'BSC-CS', 'B.Sc. Computer Science'),
    ('CS', 'MSC-CS', 'M.Sc. Computer Science'),
    -- Chemistry
    ('CHEM', 'BSC-CH',   'B.Sc. Chemistry'),
    ('CHEM', 'MSC-CH',   'M.Sc. Chemistry'),
    ('CHEM', 'BSC-BIOT', 'B.Sc. Biotechnology'),
    -- Physics
    ('PHY', 'BSC-PH',  'B.Sc. Physics'),
    ('PHY', 'MSC-PH',  'M.Sc. Physics'),
    ('PHY', 'BSC-ELE', 'B.Sc. Electronics'),
    -- Administration (college-wide / non-academic)
    ('ADMIN', 'ADMIN-GEN', 'General Administration')
) AS v(dept_code, code, name)
JOIN departments d ON d.code = v.dept_code
ON CONFLICT (department_id, code) DO NOTHING;
