"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/AuthContext";

/**
 * EmployeeRoute
 * 
 * A silent route guard that protects employee/staff pages.
 * If the user is an employee, it renders the protected content.
 * Otherwise, it redirects directly back to the standard login.
 */
export default function EmployeeRoute({ children }: { children: React.ReactNode }) {
    const { user, role, loading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading) {
            if (user && role === null) return; // Wait for role check to finish
            // If not logged in OR logged in but not an employee, kick back to login
            if (!user || role !== "employee") {
                router.push("/login");
            }
        }
    }, [user, role, authLoading, router]);

    // 1. Loading State
    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-medium">Verifying Staff Status...</p>
                </div>
            </div>
        );
    }

    // 2. Verified Employee -> Show Content
    if (user && role === "employee") {
        return <>{children}</>;
    }

    // 3. Fallback (Redirecting...)
    return null;
}