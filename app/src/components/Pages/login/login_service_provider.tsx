"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../../../lib/firebase"; 
import { verifyUserRoleAction, verifyAdminOtpAction } from "../../../lib/actions/authActions";

export function login_service_provider() {
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
            const { role } = await verifyUserRoleAction(idToken);
            
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

            // Default User Dashboard
            router.push("/dashboard"); 
            return { success: true, user: firebaseUser };
        } catch (err: any) {
            console.warn("Login Error:", err.message);
            setError(err.message || "Invalid credentials.");
            return { success: false, error: err };
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

            await verifyAdminOtpAction(idToken, otp);

            router.push("/admin/dashboard");
            return { success: true };
        } catch (err: any) {
            setError(err.message);
            return { success: false, error: err.message };
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