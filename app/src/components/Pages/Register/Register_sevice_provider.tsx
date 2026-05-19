"use client";
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { supabase } from "../../../lib/supabase";

export function register_service_provider() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const register = async (
        email: string, 
        password: string, 
        name: string, 
        isAdminRequested: boolean = false
    ) => {
        setIsLoading(true);
        setError(null);

        try {
            // 1. Create User in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const isMainAdmin = 
                email.toLowerCase() === "admin@company.com" || 
                email.toLowerCase() === "keval@ktech.com";

            // Determine role:
            // - admin@company.com → admin (auto-approved super admin)
            // - Admin requested → user (pending approval)
            // - Default → employee
            let role: string;
            if (isMainAdmin) {
                role = "admin";
            } else if (isAdminRequested) {
                role = "user"; // Stays as 'user' until admin approves
            } else {
                role = "employee"; // Default: everyone is an employee
            }

            // 2. Store User Profile in Supabase
            const { error: supabaseError } = await supabase
                .from("users")
                .insert([{
                    firebase_uid: user.uid,
                    email: email,
                    full_name: name,
                    role: role,
                    created_at: new Date().toISOString()
                }]);

            if (supabaseError) {
                await user.delete();
                throw new Error("Failed to save user data: " + supabaseError.message);
            }

            // 3. Handle Admin (auto-approved super admin)
            if (isMainAdmin) {
                const { error: adminErr } = await supabase.from("admins").insert([{
                    firebase_uid: user.uid,
                    secret_code: "123456",
                    is_super_admin: true
                }]);
                if (adminErr) throw new Error("Admin profile creation failed: " + adminErr.message);
            }

            // 4. Handle Employee (default path — auto-generate employee ID)
            if (role === "employee") {
                // Generate employee ID: EMP-XXXX (timestamp-based for uniqueness)
                const empId = `EMP-${Date.now().toString().slice(-6)}`;
                const { error: empErr } = await supabase.from("employees").insert([{
                    firebase_uid: user.uid,
                    employee_id: empId,
                    department: "Field Operations",
                    status: "active"
                }]);
                if (empErr) throw new Error("Employee profile creation failed: " + empErr.message);
            }

            // 5. Handle Admin Request (pending approval)
            if (isAdminRequested && !isMainAdmin) {
                const { error: reqErr } = await supabase.from("admin_requests").insert([{
                    firebase_uid: user.uid,
                    email: email,
                    status: "pending"
                }]);
                if (reqErr) throw new Error("Admin request submission failed: " + reqErr.message);
            }

            return { success: true, user, role };
        } catch (err: any) {
            console.error("Registration error:", err);
            
            let errorMessage = err.message || "An unexpected error occurred.";
            
            if (err.message?.includes("Failed to fetch")) {
                errorMessage = "Network error: Unable to connect to the database.";
            } else if (err.code === "auth/email-already-in-use") {
                errorMessage = "This email is already registered. Please use a different email or log in.";
            } else if (err.code === "auth/weak-password") {
                errorMessage = "Password is too weak. Please choose a stronger password.";
            } else if (err.code === "auth/invalid-email") {
                errorMessage = "Invalid email address.";
            }
            
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    };

    return { register, isLoading, error };
}
