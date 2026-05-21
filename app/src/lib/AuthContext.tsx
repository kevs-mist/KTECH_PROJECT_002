"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "./firebase";
import { employeeService } from "./services/employeeService";

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
    const data = await response.json();

    if (!response.ok || data.error) {
        throw new Error(data.error || "Unable to verify user role.");
    }

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

    // Handle Employee Online Status
    useEffect(() => {
        if (!loading && user && role === "employee") {
            // Set online
            employeeService.setOnlineStatus(true);

            // Handle tab close (best effort)
            const handleUnload = () => {
                employeeService.setOnlineStatus(false);
            };
            window.addEventListener("beforeunload", handleUnload);
            
            return () => {
                window.removeEventListener("beforeunload", handleUnload);
                // Also set offline when role/user changes or component unmounts
                employeeService.setOnlineStatus(false);
            };
        }
    }, [user, role, loading]);

    const logout = async () => {
        if (role === "employee") {
            await employeeService.setOnlineStatus(false);
        }
        await signOut(auth);
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
