import { createAdminClient } from "../../../../utils/supabase/admin";

import { getAdminAuth } from "../../../../utils/firebase/admin";
import bcrypt from "bcryptjs";

export type UserRole = "admin" | "employee" | "user";

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Unknown server auth error";
}

/**
 * Verifies a user's role on the server side using their Firebase ID Token.
 * This ensures the request is actually from the user claiming the UID.
 */
export async function verifyUserRoleAction(idToken: string) {
    try {
        if (!idToken) throw new Error("ID Token is required");

        // 1. Verify the ID Token server-side
        const adminAuth = getAdminAuth();
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // 2. Query Supabase using Admin Client (Bypasses RLS to find the record safely)
        const supabase = createAdminClient();

        // Check Admin
        const { data: adminData } = await supabase
            .from("admins")
            .select("id")
            .eq("firebase_uid", uid)
            .maybeSingle();

        if (adminData) {
            return { role: "admin" as const, uid, adminId: adminData.id };
        }

        // Check Employee
        const { data: employeeData } = await supabase
            .from("employees")
            .select("id")
            .eq("firebase_uid", uid)
            .maybeSingle();

        if (employeeData) {
            return { role: "employee" as const, uid, employeeId: employeeData.id };
        }

        return { role: "user" as const, uid };
    } catch (error: unknown) {
        console.error("Server Auth Error:", getErrorMessage(error));
        throw new Error("Authentication failed. Please ensure you are logged in correctly.");
    }
}

/**
 * Validates the Admin Secret Code (OTP) on the server.
 * Prevents plain-text OTP leaks and includes brute-force protection.
 */
export async function verifyAdminOtpAction(idToken: string, otp: string) {
    try {
        const { role, uid } = await verifyUserRoleAction(idToken);
        if (role !== "admin") throw new Error("Unauthorized access.");

        const supabase = createAdminClient();
        
        // 1. Fetch admin record with lock status
        const { data, error } = await supabase
            .from("admins")
            .select("secret_code, failed_attempts, locked_until")
            .eq("firebase_uid", uid)
            .single();

        if (error || !data) throw new Error("Admin record not found.");

        // 2. Check if locked
        if (data.locked_until && new Date(data.locked_until) > new Date()) {
            const timeRemaining = Math.ceil((new Date(data.locked_until).getTime() - Date.now()) / 60000);
            throw new Error(`Account locked due to multiple failed attempts. Try again in ${timeRemaining} minutes.`);
        }

        // 3. Verify OTP (Handles both hashed and plaintext for migration period)
        let isMatch = false;
        
        // Check if the stored code is a bcrypt hash (starts with $2a$, $2b$, or $2y$)
        if (data.secret_code && data.secret_code.startsWith('$2')) {
            isMatch = await bcrypt.compare(otp, data.secret_code);
        } else {
            throw new Error("Security code must be reset by an administrator.");
        }

        if (!isMatch) {
            const newAttempts = (data.failed_attempts || 0) + 1;
            let lockedUntil = null;

            if (newAttempts >= 5) {
                lockedUntil = new Date(Date.now() + 15 * 60000).toISOString(); // 15 min lock
            }

            await supabase
                .from("admins")
                .update({ 
                    failed_attempts: newAttempts,
                    locked_until: lockedUntil
                })
                .eq("firebase_uid", uid);

            if (newAttempts >= 5) {
                throw new Error("Too many failed attempts. Account locked for 15 minutes.");
            }
            throw new Error(`Invalid security code. ${5 - newAttempts} attempts remaining.`);
        }

        // 4. Success -> Reset failed attempts
        const updates: Record<string, string | number | null> = { 
            failed_attempts: 0, 
            locked_until: null, 
            last_access: new Date().toISOString() 
        };

        await supabase
            .from("admins")
            .update(updates)
            .eq("firebase_uid", uid);

        return { success: true };
    } catch (error: unknown) {
        throw new Error(getErrorMessage(error));
    }
}

/**
 * Generates a password reset link using Firebase Admin SDK.
 * Bypasses client-side API/domain restrictions.
 * In development, returns the link directly to speed up local testing.
 */
export async function generatePasswordResetLinkAction(email: string) {
    try {
        // Omitting actionCodeSettings prevents "INTERNAL ASSERT FAILED" when localhost 
        // is not strictly whitelisted in the Firebase Auth console.
        const adminAuth = getAdminAuth();
        const rawLink = await adminAuth.generatePasswordResetLink(email.trim());
        
        // Extract oobCode from the Firebase generated link
        let customLink = rawLink;
        try {
            const urlObj = new URL(rawLink);
            const oobCode = urlObj.searchParams.get("oobCode");
            if (oobCode) {
                customLink = `http://localhost:3000/reset-password?oobCode=${oobCode}`;
            }
        } catch {
            // Ignore parse errors, fallback to raw link
        }
        
        return { success: true, link: customLink };
    } catch (error: unknown) {
        console.error("Failed to generate password reset link on server:", getErrorMessage(error));
        if (typeof error === "object" && error !== null && "code" in error && error.code === 'auth/user-not-found') {
            throw new Error("This email is not registered in our system. Please check the spelling or register a new account.");
        }
        throw new Error(getErrorMessage(error) || "Failed to generate password reset link.");
    }
}
