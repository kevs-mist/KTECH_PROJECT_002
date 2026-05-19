import { createClient as createBrowserClient } from "../../../utils/supabase/client";

/**
 * Global Supabase Browser Client
 * Optimized for Client Components using @supabase/ssr
 */
export const supabase = createBrowserClient();
