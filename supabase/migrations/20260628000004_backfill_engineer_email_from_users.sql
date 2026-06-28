-- Migration: Backfill engineer_email on atm_locations from users.full_name
-- Description: One-shot data fix for ATMs that were imported with only an
-- engineer NAME (no email). The auto-assign lookup in the deployed build
-- requires atm_locations.engineer_email to be populated; without this, those
-- ATMs return "No engineer assigned" on ticket creation.
--
-- Behavior:
--   1. For every atm_locations row whose engineer_name matches exactly one
--      users.full_name (case-insensitive, whitespace-normalized), set
--      engineer_email to that user's email.
--   2. Leave engineer_email untouched when no match or when multiple users
--      share the same name (ambiguous — must be resolved by hand).
--   3. Report counts via RAISE NOTICE so the operator can see what changed.

DO $$
DECLARE
    updated_count     INT := 0;
    skipped_no_match  INT := 0;
    skipped_ambiguous INT := 0;
    skipped_has_email INT := 0;
    rec               RECORD;
    match_count       INT;
    matched_email     TEXT;
BEGIN
    FOR rec IN
        SELECT id, atm_id, engineer_name, engineer_email
        FROM public.atm_locations
        WHERE engineer_name IS NOT NULL
          AND length(trim(engineer_name)) > 0
    LOOP
        -- Skip rows that already have a valid email.
        IF rec.engineer_email IS NOT NULL AND length(trim(rec.engineer_email)) > 0 THEN
            skipped_has_email := skipped_has_email + 1;
            CONTINUE;
        END IF;

        -- Count exact case-insensitive matches (after trim + whitespace collapse).
        SELECT COUNT(*), MAX(email)
          INTO match_count, matched_email
          FROM public.users
         WHERE role = 'employee'
           AND full_name IS NOT NULL
           AND lower(trim(regexp_replace(full_name, '\s+', ' ', 'g')))
             = lower(trim(regexp_replace(rec.engineer_name, '\s+', ' ', 'g')));

        IF match_count = 1 AND matched_email IS NOT NULL THEN
            UPDATE public.atm_locations
               SET engineer_email = matched_email,
                   updated_at     = NOW()
             WHERE id = rec.id;
            updated_count := updated_count + 1;
            RAISE NOTICE 'Backfilled atm_id=% -> % (%)', rec.atm_id, matched_email, rec.engineer_name;
        ELSIF match_count > 1 THEN
            skipped_ambiguous := skipped_ambiguous + 1;
            RAISE NOTICE 'Skipped atm_id=% (ambiguous: % employees share name "%")',
                rec.atm_id, match_count, rec.engineer_name;
        ELSE
            skipped_no_match := skipped_no_match + 1;
            RAISE NOTICE 'Skipped atm_id=% (no employee found for name "%")',
                rec.atm_id, rec.engineer_name;
        END IF;
    END LOOP;

    RAISE NOTICE '--- Backfill summary ---';
    RAISE NOTICE 'updated         : %', updated_count;
    RAISE NOTICE 'already_had_email: %', skipped_has_email;
    RAISE NOTICE 'skipped_ambiguous: %', skipped_ambiguous;
    RAISE NOTICE 'skipped_no_match : %', skipped_no_match;
END
$$;

-- Helpful index for future name-based lookups (nullable-safe).
CREATE INDEX IF NOT EXISTS idx_users_full_name_lower
    ON public.users (lower(full_name))
    WHERE full_name IS NOT NULL;