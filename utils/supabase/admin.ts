import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Admin Client
 * WARNING: This client bypasses RLS using the service_role key.
 * ONLY use this in Server Actions or API routes after verifying the user's identity.
 */
export const createAdminClient = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Missing Supabase configuration (URL or Service Role Key).");
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
};
