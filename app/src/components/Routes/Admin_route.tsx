"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/AuthContext";

/**
 * AdminRoute
 * 
 * A Route Guard that strictly protects Admin pages.
 * If the user is an admin, it renders the protected content.
 * If not authenticated or not an admin, redirects to login.
 */
export default function AdminRoute({ children }: { children: React.ReactNode }) {
    const { user, role, loading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading) {
            if (!user || role !== "admin") {
                router.push("/login");
            }
        }
    }, [user, role, authLoading, router]);

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white font-mono">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin"></div>
                    <p className="tracking-widest text-xs uppercase opacity-60">Initializing Session...</p>
                </div>
            </div>
        );
    }

    if (user && role === "admin") {
        return <>{children}</>;
    }

    return null; // Will immediately redirect via useEffect
}
