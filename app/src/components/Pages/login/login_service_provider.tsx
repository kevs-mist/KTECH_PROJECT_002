"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../../../lib/firebase"; 
import { ErrorHandler } from "../../../lib/utils/errorHandler";
import { parseJsonResponse } from "../../../lib/apiClient";

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}


async function fetchUserRole(idToken: string) {
    const response = await fetch("/api/auth/role", {
        headers: { Authorization: `Bearer ${idToken}` },
    });
    const data = await parseJsonResponse<{ role: "admin" | "employee" | "user" }>(response, "/api/auth/role");

    return data.role;
}

async function verifyAdminOtpWithApi(idToken: string, otp: string) {
    const response = await fetch("/api/auth/admin-otp", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ otp }),
    });
    return parseJsonResponse(response, "/api/auth/admin-otp");
}

export function useLoginServiceProvider() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const login = async (username?: string, password?: string, isAdminMode: boolean = false) => {
        setIsLoading(true);
        setError(null);

        try {
            if (!username || !password) throw new Error("Please enter both username and password.");

            const userCredential = await signInWithEmailAndPassword(auth, username.trim(), password);
            const firebaseUser = userCredential.user;

            // Server verification using ID Token
            const idToken = await firebaseUser.getIdToken(true);
            const role = await fetchUserRole(idToken);

            if (role === "admin") {
                // User is admin, do NOT redirect yet. Return flag for UI to show OTP.
                setIsLoading(false);
                return { success: true, requires_otp: true, user: firebaseUser };
            }

            // If they explicitly tried to use the Admin Login but are not an admin:
            if (isAdminMode) {
                await signOut(auth); // Log them back out
                throw new Error("This profile does not have Administrator privileges.");
            }

            if (role === "employee") {
                router.push("/employee/dashboard");
                return { success: true, user: firebaseUser };
            }

            // If role is "user" but they should be employee, redirect to employee dashboard
            // This handles cases where the role wasn't properly set in the database
            if (role === "user") {
                router.push("/employee/dashboard");
                return { success: true, user: firebaseUser };
            }

            // Fallback to employee dashboard for any other role
            router.push("/employee/dashboard"); 
            return { success: true, user: firebaseUser };
        } catch (err: unknown) {
            console.warn("Login Error:", getErrorMessage(err));
            await signOut(auth);
            const friendlyMessage = ErrorHandler.format(err, "Invalid credentials.");
            setError(friendlyMessage);
            return { success: false, error: friendlyMessage };
        } finally {
            setIsLoading(false);
        }
    };

    const verifyAdminOtp = async (otp: string) => {
        setIsLoading(true);
        setError(null);
        try {
            if (!auth.currentUser) throw new Error("Session expired. Please try again.");
            const idToken = await auth.currentUser.getIdToken(true);

            await verifyAdminOtpWithApi(idToken, otp);

            router.push("/admin/dashboard");
            return { success: true };
        } catch (err: unknown) {
            const friendlyMessage = ErrorHandler.format(err, "Verification failed. Please try again.");
            setError(friendlyMessage);
            return { success: false, error: friendlyMessage };
        } finally {
            setIsLoading(false);
        }
    };


    return {
        login,
        verifyAdminOtp,
        logout: async () => {
             await signOut(auth);
             router.push("/login");
        },
        isLoading,
        error
    };
}
