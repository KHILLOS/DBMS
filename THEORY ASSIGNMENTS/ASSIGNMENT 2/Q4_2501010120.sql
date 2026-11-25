-- Q4_2501010120.sql
-- Cursor-Based Doctor Appointment Summary.
-- Uses an explicit cursor for doctors and a parameterised cursor for appointments.

CREATE OR REPLACE PROCEDURE doctor_appointment_summary(
    p_from DATE,
    p_to DATE
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- Explicit cursor over all doctors, in doctor_id order.
    cur_doctors CURSOR FOR
        SELECT doctor_id, doctor_name, specialization, consultation_fee
        FROM doctors
        ORDER BY doctor_id;

    -- Parameterised cursor: one doctor's appointments in the inclusive date range.
    cur_appts(c_doc INT) CURSOR FOR
        SELECT appt_status
        FROM appointments
        WHERE doctor_id = c_doc
          AND appt_date BETWEEN p_from AND p_to
        ORDER BY appt_date, appointment_id;

    v_doctor_id INT;
    v_doctor_name VARCHAR(60);
    v_specialization VARCHAR(40);
    v_fee NUMERIC(8,2);

    v_appt_status VARCHAR(12);
    v_total INT;
    v_completed INT;
    v_cancelled INT;
    v_scheduled INT;
    v_revenue NUMERIC(12,2);

    v_grand_total INT := 0;
    v_grand_completed INT := 0;
    v_grand_revenue NUMERIC(14,2) := 0;
BEGIN
    IF p_from IS NULL OR p_to IS NULL THEN
        RAISE EXCEPTION 'Both start date and end date are required.';
    END IF;

    IF p_from > p_to THEN
        RAISE EXCEPTION 'Invalid date range: start date % is after end date %.',
            p_from, p_to;
    END IF;

    RAISE NOTICE 'Doctor Appointment Summary: % to %', p_from, p_to;

    OPEN cur_doctors;

    LOOP
        FETCH cur_doctors
        INTO v_doctor_id, v_doctor_name, v_specialization, v_fee;

        EXIT WHEN NOT FOUND;

        v_total := 0;
        v_completed := 0;
        v_cancelled := 0;
        v_scheduled := 0;

        OPEN cur_appts(v_doctor_id);

        LOOP
            FETCH cur_appts INTO v_appt_status;
            EXIT WHEN NOT FOUND;

            v_total := v_total + 1;

            IF v_appt_status = 'COMPLETED' THEN
                v_completed := v_completed + 1;
            ELSIF v_appt_status = 'CANCELLED' THEN
                v_cancelled := v_cancelled + 1;
            ELSIF v_appt_status = 'SCHEDULED' THEN
                v_scheduled := v_scheduled + 1;
            END IF;
        END LOOP;

        CLOSE cur_appts;

        v_revenue := v_completed * v_fee;

        IF v_total = 0 THEN
            RAISE NOTICE '% (%): No appointments in this period',
                v_doctor_name, v_specialization;
        ELSE
            RAISE NOTICE '% (%): Total=% Completed=% Cancelled=% Scheduled=% Revenue=%',
                v_doctor_name, v_specialization, v_total, v_completed,
                v_cancelled, v_scheduled, TO_CHAR(v_revenue, 'FM999999990.00');
        END IF;

        v_grand_total := v_grand_total + v_total;
        v_grand_completed := v_grand_completed + v_completed;
        v_grand_revenue := v_grand_revenue + v_revenue;
    END LOOP;

    CLOSE cur_doctors;

    RAISE NOTICE 'GRAND TOTAL: Appointments=% Completed=% Revenue=%',
        v_grand_total, v_grand_completed,
        TO_CHAR(v_grand_revenue, 'FM999999990.00');
END;
$$;

-- TESTS: run separately; the third call is expected to raise an error.
CALL doctor_appointment_summary('2026-10-01', '2026-10-31');
CALL doctor_appointment_summary('2026-11-01', '2026-11-30');
CALL doctor_appointment_summary('2026-12-01', '2026-11-01'); -- expected ERROR

