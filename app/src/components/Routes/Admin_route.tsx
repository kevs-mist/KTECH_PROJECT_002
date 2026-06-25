"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/AuthContext";

/**
 * AdminRoute
 * 
 * A Route Guard that strictly protects Admin pages.
 * If the user is an admin, it renders the protected content.
 * If not authenticated or not an admin, directly routes to the standard login page.
 */
export default function AdminRoute({ children }: { children: React.ReactNode }) {
    const { user, role, loading: authLoading } = useAuth();
    const router = useRouter();
    const roleLoading = authLoading || (user !== null && role === null);

    useEffect(() => {
        if (roleLoading) return;

        if (!user || role !== "admin") {
            router.replace("/login");
        }
    }, [user, role, roleLoading, router]);

    if (roleLoading) {
        return (
            <div 
                role="status"
                aria-label="Loading"
                aria-live="polite"
                className="flex items-center justify-center min-h-screen bg-slate-900 text-white font-mono"
            >
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" aria-hidden="true"></div>
                    <p className="tracking-widest text-xs uppercase opacity-60">Initializing Session...</p>
                    <span className="sr-only">Initializing Session, please wait...</span>
                </div>
            </div>
        );
    }

    if (user && role === "admin") {
        return <>{children}</>;
    }

    return null;
}