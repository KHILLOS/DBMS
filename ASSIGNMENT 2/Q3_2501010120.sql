-- Q3_2501010120.sql
-- Stored Procedures for Patient Registration, Treatment and Discharge.
-- Run after setup.sql and Q1_2501010120.sql.

CREATE OR REPLACE PROCEDURE register_patient(
    p_name VARCHAR,
    p_dob DATE,
    p_gender CHAR,
    p_phone VARCHAR,
    INOUT p_patient_id INT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_name IS NULL OR BTRIM(p_name) = '' THEN
        RAISE EXCEPTION 'Patient name cannot be empty or blank.';
    END IF;

    IF p_dob IS NULL OR p_dob > CURRENT_DATE THEN
        RAISE EXCEPTION 'Date of birth cannot be in the future.';
    END IF;

    IF p_phone IS NULL OR p_phone !~ '^[0-9]{10}$' THEN
        RAISE EXCEPTION 'Phone number must contain exactly 10 digits.';
    END IF;

    IF EXISTS (SELECT 1 FROM patients WHERE phone = p_phone) THEN
        RAISE EXCEPTION 'Phone number % is already registered.', p_phone;
    END IF;

    INSERT INTO patients (patient_name, dob, gender, phone)
    VALUES (BTRIM(p_name), p_dob, p_gender, p_phone)
    RETURNING patient_id INTO p_patient_id;

    RAISE NOTICE 'Patient % registered with ID %', p_name, p_patient_id;
END;
$$;


CREATE OR REPLACE PROCEDURE add_treatment(
    p_patient_id INT,
    p_doctor_id INT,
    p_diagnosis VARCHAR,
    p_cost NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_patient_status VARCHAR(20);
    v_consultation_fee NUMERIC(8,2);
    v_bill_amount NUMERIC(10,2);
BEGIN
    SELECT status
    INTO v_patient_status
    FROM patients
    WHERE patient_id = p_patient_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Patient % does not exist.', p_patient_id;
    END IF;

    IF v_patient_status = 'DISCHARGED' THEN
        RAISE EXCEPTION 'Patient % is DISCHARGED and cannot receive treatment.',
            p_patient_id;
    END IF;

    SELECT consultation_fee
    INTO v_consultation_fee
    FROM doctors
    WHERE doctor_id = p_doctor_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Doctor % does not exist.', p_doctor_id;
    END IF;

    IF p_cost IS NULL OR p_cost <= 0 THEN
        RAISE EXCEPTION 'Invalid cost: treatment cost must be greater than zero.';
    END IF;

    IF p_diagnosis IS NULL OR BTRIM(p_diagnosis) = '' THEN
        RAISE EXCEPTION 'Diagnosis cannot be empty.';
    END IF;

    INSERT INTO treatments (patient_id, doctor_id, diagnosis, cost)
    VALUES (p_patient_id, p_doctor_id, p_diagnosis, p_cost);

    v_bill_amount := p_cost + v_consultation_fee;

    INSERT INTO billing (patient_id, amount)
    VALUES (p_patient_id, v_bill_amount);

    -- Q1 trigger automatically records this genuine status change.
    UPDATE patients
    SET status = 'UNDER_TREATMENT'
    WHERE patient_id = p_patient_id
      AND status IS DISTINCT FROM 'UNDER_TREATMENT';

    RAISE NOTICE 'Bill amount generated for patient %: %',
        p_patient_id, v_bill_amount;
END;
$$;


CREATE OR REPLACE PROCEDURE discharge_patient(
    p_patient_id INT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_status VARCHAR(20);
    v_outstanding NUMERIC(12,2);
BEGIN
    SELECT status
    INTO v_status
    FROM patients
    WHERE patient_id = p_patient_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Patient % does not exist.', p_patient_id;
    END IF;

    v_outstanding := COALESCE(
        (SELECT SUM(amount - amount_paid)
         FROM billing
         WHERE patient_id = p_patient_id),
        0
    );

    IF v_outstanding > 0 THEN
        RAISE EXCEPTION 'Patient % cannot be discharged. Outstanding dues: %',
            p_patient_id, v_outstanding;
    END IF;

    UPDATE patients
    SET status = 'DISCHARGED'
    WHERE patient_id = p_patient_id
      AND status IS DISTINCT FROM 'DISCHARGED';

    RAISE NOTICE 'Patient % has been discharged successfully.', p_patient_id;
END;
$$;

-- TESTS: run each CALL separately because some are expected to raise errors.
CALL register_patient('Meera Joshi', '1998-03-15', 'F', '9810000006'); -- ID 6
CALL register_patient('Test Future', '2030-01-01', 'M', '9810000007'); -- expected ERROR
CALL register_patient('Bad Phone', '1990-01-01', 'M', '98100');        -- expected ERROR
CALL register_patient('Dup Phone', '1990-01-01', 'M', '9810000006');   -- expected ERROR

CALL add_treatment(6, 4, 'Eczema', 3000); -- bill amount 3700
CALL add_treatment(6, 9, 'Eczema', 3000); -- expected ERROR: doctor 9
CALL add_treatment(6, 4, 'Eczema', 0);    -- expected ERROR: invalid cost

CALL discharge_patient(6); -- expected ERROR: outstanding dues 3700
UPDATE billing SET amount_paid = amount WHERE patient_id = 6;
CALL discharge_patient(6); -- success

CALL add_treatment(6, 4, 'Rash', 1000); -- expected ERROR: patient is DISCHARGED

SELECT *
FROM patient_status_audit
WHERE patient_id = 6
ORDER BY audit_id;

-- Final verification
SELECT patient_id, patient_name, status
FROM patients
WHERE patient_id = 6;

SELECT treatment_id, patient_id, diagnosis, cost
FROM treatments
WHERE patient_id = 6;

SELECT bill_id, patient_id, amount, amount_paid
FROM billing
WHERE patient_id = 6;
