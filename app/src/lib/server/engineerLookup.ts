import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface EngineerLookupResult {
    firebase_uid: string;
    email: string;
    full_name: string | null;
}

export interface AtmEngineerSource {
    atm_id?: string | null;
    engineer_email?: string | null;
    engineer_name?: string | null;
}

/**
 * Resolve an engineer from an ATM row's engineer_email OR engineer_name.
 *
 * Primary: case-insensitive email match on users.email (role = 'employee').
 * Fallback: case-insensitive full_name match on users.full_name (role = 'employee')
 *           when no email is present or no user matches the email.
 *
 * Returns null when no engineer resolves. Never throws — logs and returns null
 * on lookup errors so callers can keep going with status = 'open'.
 */
export async function resolveEngineerFromAtm(
    supabase: SupabaseClient,
    atm: AtmEngineerSource
): Promise<EngineerLookupResult | null> {
    // 1. Email match (preferred — exact).
    const email = atm.engineer_email?.trim();
    if (email) {
        const { data: byEmail, error: emailErr } = await supabase
            .from("users")
            .select("firebase_uid, email, full_name")
            .eq("role", "employee")
            .ilike("email", email)
            .maybeSingle();

        if (emailErr) {
            console.error("[resolveEngineerFromAtm] email lookup error:", emailErr);
        }
        if (byEmail?.firebase_uid) {
            return byEmail;
        }
    }

    // 2. Name fallback (only when no email result).
    const name = atm.engineer_name?.trim();
    if (!name) return null;

    const { data: byName, error: nameErr } = await supabase
        .from("users")
        .select("firebase_uid, email, full_name")
        .eq("role", "employee")
        .ilike("full_name", name)
        .maybeSingle();

    if (nameErr) {
        console.error("[resolveEngineerFromAtm] name lookup error:", nameErr);
    }

    if (byName?.firebase_uid) {
        // Backfill the email on the ATM so future lookups hit the fast path.
        // Best-effort — failure here must not block the caller.
        if (byName.email && atm.atm_id) {
            supabase
                .from("atm_locations")
                .update({ engineer_email: byName.email })
                .eq("atm_id", atm.atm_id)
                .then(({ error }) => {
                    if (error) {
                        console.error(
                            "[resolveEngineerFromAtm] backfill engineer_email failed:",
                            error
                        );
                    }
                });
        }
        return byName;
    }

    return null;
}