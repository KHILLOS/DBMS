PL/pgSQL ASSIGNMENT SOLUTION
Student roll number used in filenames: 2501010120

FILES
- Q1_2501010120.sql: status audit table and triggers
- Q2_2501010120.sql: manual transaction/savepoints, apply_payment procedure, and Part C answers
- Q3_2501010120.sql: register_patient, add_treatment, discharge_patient
- Q4_2501010120.sql: explicit and parameterised cursor report

EXECUTION ORDER
1. Create a PostgreSQL database (for example hospital_db).
2. Run the complete Database Setup Script from pages 2-3 of the assignment.
3. Run Q1. Execute its test statements one at a time. T5 is supposed to fail; continue with T6.
4. Run Q2 Part A one statement at a time in order. After the invalid payment UPDATE, execute
   ROLLBACK TO SAVEPOINT sp_payment, then COMMIT. Then create the procedure and run each CALL.
   Keep pgAdmin Auto commit ON for Part B calls. Do not wrap CALL apply_payment(...) in BEGIN/COMMIT.
5. Run Q3. Each marked ERROR test is expected to fail; execute the next test separately.
6. Run Q4 and inspect the Messages tab for RAISE NOTICE output.

IMPORTANT
- Re-run setup.sql only if you intentionally want to reset all tables and sample data. It drops
  tables and removes the Q1 audit trigger/table; after a reset, rerun Q1 before Q3.
- Expected-error statements should be executed individually in pgAdmin so you can continue testing.
- Capture your own pgAdmin screenshots for the required Data Output and Messages tabs. Screenshots
  cannot be truthfully generated without running the scripts in your PostgreSQL instance.
- Verify Q1 and Q3 audit rows, Q2 final billing/treatment counts, and Q4 October/November totals
  against the expected values in the assignment.
