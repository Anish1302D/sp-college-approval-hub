-- Master runner. Loads schema then seed in order.
-- Usage:
--   psql -U postgres -d spc_approval -f db/run_all.sql

\echo === Schema ===
\i db/schema/00_extensions.sql
\i db/schema/01_enums.sql
\i db/schema/02_master_data.sql
\i db/schema/03_workflow.sql
\i db/schema/04_requests.sql
\i db/schema/05_approvals.sql
\i db/schema/06_comms.sql
\i db/schema/07_audit_and_files.sql
\i db/schema/08_non_financial.sql
\i db/schema/09_inventory.sql
\i db/schema/10_triggers.sql
\i db/schema/11_views.sql
\i db/schema/12_functions.sql
\i db/schema/13_record_action.sql
\i db/schema/14_rls.sql

\echo === Seed ===
\i db/seed/01_roles_and_stages.sql
\i db/seed/02_sample_master_data.sql
\i db/seed/03_users_and_approvers.sql

\echo === Done ===
