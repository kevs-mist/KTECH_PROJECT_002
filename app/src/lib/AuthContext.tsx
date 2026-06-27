"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "./firebase";
import { employeeService } from "./services/employeeService";
import { parseJsonResponse } from "./apiClient";

export type UserRole = "admin" | "employee" | "user" | null;

interface AuthContextType {
    user: User | null;
    role: UserRole;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchUserRole(idToken: string): Promise<UserRole> {
    const response = await fetch("/api/auth/role", {
        headers: { Authorization: `Bearer ${idToken}` },
    });
    const data = await parseJsonResponse<{ role: UserRole }>(response, "/api/auth/role");

    return data.role;
}

/**
 * AuthProvider
 * 
 * Centralized authentication and role management.
 * Watches Firebase auth and fetches the user's role from Supabase.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setLoading(true);
            if (firebaseUser) {
                setUser(firebaseUser);
                
                // Fetch Role securely from Server
                try {
                    const idToken = await firebaseUser.getIdToken(true);
                    const verifiedRole = await fetchUserRole(idToken);
                    setRole(verifiedRole);
                } catch (err) {
                    console.error("Auth role verification error:", err);
                    setUser(null);
                    setRole(null);
                    await signOut(auth);
                }
            } else {
                setUser(null);
                setRole(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Periodic role re-verification (every 30 seconds)
    // This ensures if an admin promotes a user to employee, the UI updates in real-time
    useEffect(() => {
        if (!user || loading) return;

        const interval = setInterval(async () => {
            try {
                const idToken = await user.getIdToken(true);
                const verifiedRole = await fetchUserRole(idToken);
                setRole(verifiedRole);
            } catch (err) {
                console.error("Background role verification error:", err);
            }
        }, 30000); // 30 seconds

        return () => clearInterval(interval);
    }, [user, loading]);

    // Handle Employee Online Status with Heartbeat
    useEffect(() => {
        if (!loading && user && role === "employee") {
            let heartbeatInterval: NodeJS.Timeout;
            let isPageVisible = true;

            // Set online immediately
            employeeService.setOnlineStatus(true);

            // Heartbeat to keep status online (every 60 seconds)
            const startHeartbeat = () => {
                heartbeatInterval = setInterval(() => {
                    if (isPageVisible) {
                        employeeService.setOnlineStatus(true);
                    }
                }, 60000);
            };

            // Page visibility detection
            const handleVisibilityChange = () => {
                isPageVisible = !document.hidden;
                if (isPageVisible) {
                    employeeService.setOnlineStatus(true);
                    startHeartbeat();
                } else {
                    clearInterval(heartbeatInterval);
                    employeeService.setOnlineStatus(false);
                }
            };

            // Handle tab close (best effort)
            const handleUnload = () => {
                employeeService.setOnlineStatus(false);
            };

            // Start heartbeat
            startHeartbeat();

            // Add event listeners
            document.addEventListener('visibilitychange', handleVisibilityChange);
            window.addEventListener("beforeunload", handleUnload);
            
            return () => {
                clearInterval(heartbeatInterval);
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                window.removeEventListener("beforeunload", handleUnload);
                // Set offline when component unmounts
                employeeService.setOnlineStatus(false);
            };
        }
    }, [user, role, loading]);

    const logout = async () => {
        // Set offline before signing out
        if (role === "employee") {
            try {
                await employeeService.setOnlineStatus(false);
            } catch (err) {
                console.error("Failed to set offline during logout:", err);
            }
        }
        await signOut(auth);
        // Force reload to clear any cached state
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{ user, role, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * useAuth Hook
 * Access current user, role, and loading state anywhere in the app.
 */
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
