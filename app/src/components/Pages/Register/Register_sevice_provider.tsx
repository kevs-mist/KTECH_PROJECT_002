"use client";
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { supabase } from "../../../lib/supabase";

export function register_service_provider() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const register = async (email: string, password: string, name: string, isAdminRequested: boolean = false) => {
        setIsLoading(true);
        setError(null);

        try {
            // 1. Create User in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const isMainAdmin = email.toLowerCase() === "admin@company.com";

            // 2. Store User Profile Data in Supabase
            const { error: supabaseError } = await supabase
                .from("users")
                .insert([
                    {
                        firebase_uid: user.uid,
                        email: email,
                        full_name: name,
                        role: isMainAdmin ? "admin" : "user",
                        created_at: new Date().toISOString()
                    }
                ]);

            if (supabaseError) {

                await user.delete();
                throw new Error("Failed to save user data: " + supabaseError.message);
            }

            // 3. Handle Admin Logic
            if (isMainAdmin) {
                // Auto-approve Preset super admin
                const { error: adminErr } = await supabase.from("admins").insert([{
                    firebase_uid: user.uid,
                    secret_code: "123456", // Default OTP for testing
                    is_super_admin: true
                }]);
                
                if (adminErr) {
                    throw new Error("Admin profile creation failed: " + adminErr.message);
                }
                console.log("Super Admin auto-created.");
            } else if (isAdminRequested) {
                // Submit admin request for others
                const { error: reqErr } = await supabase.from("admin_requests").insert([{
                    firebase_uid: user.uid,
                    email: email,
                    status: "pending"
                }]);
                
                if (reqErr) {
                    throw new Error("Admin request failed: " + reqErr.message);
                }
                console.log("Admin request submitted for approval.");
            }

            console.log("Registration complete. User saved to Firebase and Supabase.");
            return { success: true, user };
        } catch (err: any) {
            console.warn("Registration error:", err.message);
            setError(err.message || "An unexpected error occurred during registration.");
            return { success: false, error: err.message };
        } finally {
            setIsLoading(false);
        }
    };

    return { register, isLoading, error };
}
