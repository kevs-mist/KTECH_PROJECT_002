"use server";

import { createAdminClient } from "../../../../utils/supabase/admin";

import { adminAuth } from "../../../../utils/firebase/admin";

export type UserRole = "admin" | "employee" | "user";

/**
 * Verifies a user's role on the server side using their Firebase ID Token.
 * This ensures the request is actually from the user claiming the UID.
 */
export async function verifyUserRoleAction(idToken: string) {
    try {
        if (!idToken) throw new Error("ID Token is required");

        // 1. Verify the ID Token server-side
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
    } catch (error: any) {
        console.error("Server Action Auth Error:", error.message);
        throw new Error("Authentication failed. Please ensure you are logged in correctly.");
    }
}

import bcrypt from "bcryptjs";

// ...

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
        let needsHashing = false;
        try {
            // Try as hashed first
            isMatch = await bcrypt.compare(otp, data.secret_code);
        } catch (e) {
            // Fallback for plaintext (if bcrypt fails to identify as hash)
            isMatch = data.secret_code === otp;
            if (isMatch) needsHashing = true;
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
        const updates: any = { 
            failed_attempts: 0, 
            locked_until: null, 
            last_access: new Date().toISOString() 
        };

        // Auto-hash during migration (S-02)
        if (needsHashing) {
            updates.secret_code = await bcrypt.hash(otp, 10);
        }

        await supabase
            .from("admins")
            .update(updates)
            .eq("firebase_uid", uid);

        return { success: true };
    } catch (error: any) {
        throw new Error(error.message);
    }
}
