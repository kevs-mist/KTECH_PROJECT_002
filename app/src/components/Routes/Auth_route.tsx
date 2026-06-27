"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/AuthContext";

/**
 * AuthRoute
 * 
 * A general-purpose guard for standard authenticated users.
 * Redirects to /login if the user is not authenticated.
 */
export default function AuthRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.replace("/login");
        }
    }, [loading, user, router]);

    if (loading) {
        return (
            <div 
                role="status"
                aria-label="Loading"
                aria-live="polite"
                className="flex items-center justify-center min-h-screen"
                style={{ background: 'var(--bg-base)' }}
            >
                <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '4px solid var(--border-subtle)', borderTopColor: 'var(--accent)' }} aria-hidden="true"></div>
                <span className="sr-only">Loading page content, please wait...</span>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return <>{children}</>;
}
