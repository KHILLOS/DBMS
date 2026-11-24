-- Q2_2501010120.sql
-- Transactions, Savepoints and apply_payment procedure.
-- Part A: Execute the transaction statements one at a time in the order shown.
-- Do not run the whole Part A script as one batch because you must observe
-- the failed statement and recover with ROLLBACK TO SAVEPOINT.

-- =========================
-- PART A - MANUAL TRANSACTION
-- =========================
BEGIN;

INSERT INTO treatments (patient_id, doctor_id, diagnosis, cost)
VALUES (2, 1, 'Follow-up ECG', 2500);

INSERT INTO billing (patient_id, amount)
VALUES (2, 2500);

SAVEPOINT sp_treatment;

-- Add 10,000 to the older bill (bill_id 1).
UPDATE billing
SET amount_paid = amount_paid + 10000
WHERE bill_id = 1;

SAVEPOINT sp_payment;

-- Mistake 1: logical error. This makes all patient 2 bills fully paid.
UPDATE billing
SET amount_paid = amount
WHERE patient_id = 2;

SELECT bill_id, patient_id, amount, amount_paid
FROM billing
WHERE patient_id = 2
ORDER BY bill_id;

-- Undo only Mistake 1; preserve the earlier 10,000 payment.
ROLLBACK TO SAVEPOINT sp_payment;

SELECT bill_id, patient_id, amount, amount_paid
FROM billing
WHERE patient_id = 2
ORDER BY bill_id;

-- Mistake 2: expected CHECK constraint violation.
-- After this statement fails, the transaction enters aborted state.
UPDATE billing
SET amount_paid = amount_paid + 1000
WHERE bill_id = 1;

-- A SELECT issued now will report:
-- ERROR: current transaction is aborted, commands ignored until end of transaction block.
-- Recover to the savepoint created before the failed statement:
ROLLBACK TO SAVEPOINT sp_payment;

COMMIT;

-- Verify Part A final state.
SELECT bill_id, patient_id, amount, amount_paid
FROM billing
ORDER BY bill_id;

SELECT COUNT(*) AS treatment_count FROM treatments;

-- Expected after Part A: bill 1 paid 15000; bill 2 unchanged; bill 3 amount 2500,
-- paid 0; treatment_count = 3.

-- =========================
-- PART B - PROCEDURE
-- =========================
CREATE OR REPLACE PROCEDURE apply_payment(
    p_bill_id INT,
    p_amount NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_amount      NUMERIC(10,2);
    v_amount_paid NUMERIC(10,2);
    v_balance     NUMERIC(10,2);
    v_payment_ok  BOOLEAN := FALSE;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero.';
    END IF;

    -- The inner block behaves like a savepoint. A CHECK violation rolls
    -- back only the UPDATE inside this block.
    BEGIN
        SELECT amount, amount_paid
        INTO v_amount, v_amount_paid
        FROM billing
        WHERE bill_id = p_bill_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Bill % not found', p_bill_id;
        END IF;

        UPDATE billing
        SET amount_paid = amount_paid + p_amount
        WHERE bill_id = p_bill_id;

        v_payment_ok := TRUE;

    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE
                'Payment of % rejected for bill %: payment would exceed bill amount.',
                p_amount, p_bill_id;
            -- Exception is handled; the inner block's update is rolled back.
    END;

    -- If no exception occurred, calculate and display the remaining balance.
    -- For a rejected payment, the bill is unchanged and the balance is still valid.
    SELECT amount - amount_paid
    INTO v_balance
    FROM billing
    WHERE bill_id = p_bill_id;

    IF FOUND AND v_payment_ok THEN
        RAISE NOTICE 'Payment successful. Remaining balance due on bill %: %',
            p_bill_id, v_balance;
    END IF;

    COMMIT;
END;
$$;

-- Tests: call each separately with Auto commit ON.
CALL apply_payment(3, 1000); -- success; remaining balance 1500
CALL apply_payment(3, 5000); -- rejected by NOTICE; no change
CALL apply_payment(99, 100); -- expected ERROR: Bill 99 not found

SELECT bill_id, amount, amount_paid
FROM billing
ORDER BY bill_id;

-- PART C - SHORT WRITTEN ANSWERS
-- 1. After the CHECK-violating UPDATE, PostgreSQL reports:
--    "current transaction is aborted, commands ignored until end of transaction block".
--    The failed statement marks the current transaction as aborted, so ordinary SQL
--    commands cannot run until the transaction is rolled back or recovered to a
--    savepoint. ROLLBACK TO SAVEPOINT sp_payment restores the state to that savepoint
--    and preserves the treatment and new bill inserted before it. A full ROLLBACK
--    would undo the treatment, new bill and all other changes made in the transaction.
--
-- 2. A procedure may perform transaction control (COMMIT/ROLLBACK) when CALL is
--    executed as a top-level statement, which is what happens with pgAdmin Auto
--    commit ON. If the caller first issues BEGIN, CALL runs inside an already-open
--    transaction block. PostgreSQL does not allow the procedure to COMMIT that
--    caller-owned transaction, so it raises "invalid transaction termination".
