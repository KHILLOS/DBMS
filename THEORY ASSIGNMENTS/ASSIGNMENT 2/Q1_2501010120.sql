-- Q1_2501010120.sql
-- Status Change Audit Trigger
-- Run after the assignment's database setup.sql script.

CREATE TABLE IF NOT EXISTS patient_status_audit (
    audit_id   SERIAL PRIMARY KEY,
    patient_id INT NOT NULL REFERENCES patients(patient_id),
    old_status VARCHAR(20) NOT NULL,
    new_status VARCHAR(20) NOT NULL,
    changed_by TEXT NOT NULL DEFAULT CURRENT_USER,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION fn_log_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO patient_status_audit
        (patient_id, old_status, new_status)
    VALUES
        (NEW.patient_id, OLD.status, NEW.status);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_patient_status_audit ON patients;

CREATE TRIGGER trg_patient_status_audit
AFTER UPDATE OF status ON patients
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION fn_log_status_change();

CREATE OR REPLACE FUNCTION fn_block_discharged()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status = 'DISCHARGED'
       AND NEW.status IS DISTINCT FROM 'REGISTERED' THEN
        RAISE EXCEPTION
            'Patient % is DISCHARGED. Re-register before changing status to %.',
            OLD.patient_id, NEW.status;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_discharged ON patients;

CREATE TRIGGER trg_block_discharged
BEFORE UPDATE OF status ON patients
FOR EACH ROW
EXECUTE FUNCTION fn_block_discharged();

-- TESTS
-- Run each statement separately so T5's expected error does not stop later tests.
UPDATE patients SET status = 'ADMITTED' WHERE patient_id = 1;          -- T1: logged
UPDATE patients SET status = 'ADMITTED' WHERE patient_id = 1;          -- T2: not logged
UPDATE patients SET phone = '9810000044' WHERE patient_id = 4;         -- T3: not logged
UPDATE patients SET status = 'UNDER_TREATMENT' WHERE patient_id = 2;   -- T4: logged
UPDATE patients SET status = 'ADMITTED' WHERE patient_id = 5;          -- T5: expected ERROR
UPDATE patients SET status = 'REGISTERED' WHERE patient_id = 5;        -- T6: logged

SELECT audit_id, patient_id, old_status, new_status, changed_by, changed_at
FROM patient_status_audit
ORDER BY audit_id;
