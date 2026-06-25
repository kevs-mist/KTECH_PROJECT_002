"use client";
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../../lib/firebase";

type RegisteredRole = "admin" | "employee" | "user";

export function useRegisterServiceProvider() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const register = async (email: string, password: string, name: string, isAdminRequested: boolean = false) => {
        setIsLoading(true);
        setError(null);

        try {
            // 1. Create User in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Call server-side API to create user profile in Supabase
            const idToken = await user.getIdToken();
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({ name, isAdminRequested }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.error || `Server returned status ${response.status}`;
                // Roll back Firebase user creation
                await user.delete();
                throw new Error("Failed to save user data: " + errorMessage);
            }

            const data = await response.json();
            const registeredRole: RegisteredRole = data.role;

            console.log("Registration complete. User saved to Firebase and Supabase.");
            return { success: true, user: { ...user, role: registeredRole } };
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

