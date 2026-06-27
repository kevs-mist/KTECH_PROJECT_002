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

    // A user is present but role hasn't resolved from server yet — still loading
    const roleLoading = authLoading || (user !== null && role === null);

    useEffect(() => {
        if (roleLoading) return; // Don't act until role is fully known

        // Role is now resolved — redirect if not an employee
        if (!user || role !== "employee") {
            router.push("/login");
        }
    }, [user, role, roleLoading, router]);

    // 1. Loading State (auth OR role-fetch in flight)
    if (roleLoading) {
        return (
            <div 
                role="status"
                aria-label="Loading"
                aria-live="polite"
                className="flex items-center justify-center min-h-screen"
                style={{ background: 'var(--bg-base)' }}
            >
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full animate-spin" style={{ border: '4px solid var(--border-subtle)', borderTopColor: 'var(--success)' }} aria-hidden="true"></div>
                    <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>Verifying Staff Status...</p>
                    <span className="sr-only">Verifying Staff Status, please wait...</span>
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