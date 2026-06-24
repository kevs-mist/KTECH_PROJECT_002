"use client";

import React, { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../src/lib/firebase";
import { supabase } from "../src/lib/supabase";
import { parseJsonResponse } from "../src/lib/apiClient";
import AdminRoute from "../src/components/Routes/Admin_route";

type AuthDiagnostics = Record<string, unknown>;

/**
 * ConnectionDiagnostics
 * 
 * A developer tool to verify connectivity with Firebase Auth and Supabase.
 */
function ConnectionDiagnostics() {
    const [firebaseStatus, setFirebaseStatus] = useState<"checking" | "connected" | "error">("checking");
    const [supabaseStatus, setSupabaseStatus] = useState<"checking" | "connected" | "error">("checking");
    const [firebaseError, setFirebaseError] = useState<string | null>(null);
    const [supabaseError, setSupabaseError] = useState<string | null>(null);
    const [authDiagnostics, setAuthDiagnostics] = useState<AuthDiagnostics | null>(null);

    useEffect(() => {
        // 1. Test Firebase
        const testFirebase = async () => {
            try {
                if (!auth) throw new Error("Firebase Auth object is not initialized.");
                // A simple check like appConfig exists or auth is ready
                setFirebaseStatus("connected");
            } catch (err: unknown) {
                setFirebaseStatus("error");
                setFirebaseError(err instanceof Error ? err.message : String(err));
            }
        };

        // 2. Test Supabase
        const testSupabase = async () => {
            try {
                // Attempt a simple query to verify connection
                const { error } = await supabase.from("_diagnostics").select("count").limit(1).maybeSingle();
                
                // Note: _diagnostics might not exist, that's fine if we get a 404/401 instead of a network error
                if (error && error.message.includes("Failed to fetch")) {
                    throw new Error("Could not reach Supabase. Check your URL and connection.");
                }
                
                setSupabaseStatus("connected");
            } catch (err: unknown) {
                setSupabaseStatus("error");
                setSupabaseError(err instanceof Error ? err.message : String(err));
            }
        };

        testFirebase();
        testSupabase();

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) return;

            try {
                const token = await user.getIdToken(true);
                const response = await fetch("/api/auth-diagnostics", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setAuthDiagnostics(await parseJsonResponse<AuthDiagnostics>(response, "/api/auth-diagnostics"));
            } catch (err: unknown) {
                setAuthDiagnostics({ error: err instanceof Error ? err.message : String(err) });
            }
        });

        return () => unsubscribe();
    }, []);

    const StatusBadge = ({ status, error }: { status: string, error?: string | null }) => {
        if (status === "checking") return <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs animate-pulse">Checking...</span>;
        if (status === "connected") return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">Connected</span>;
        return (
            <div className="flex flex-col gap-2">
                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold w-fit">Connection Failed</span>
                <p className="text-[10px] text-red-500 font-mono max-w-xs">{error}</p>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full border border-slate-200">
                <header className="mb-8 border-b border-slate-100 pb-4">
                    <h1 className="text-2xl font-bold text-slate-800">System Diagnostics</h1>
                    <p className="text-slate-500 text-sm">Validating configuration and connectivity...</p>
                </header>

                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center text-orange-500">
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M5.33 13.922h13.33L16.275 19H7.72l-2.39-5.078zm1.09-2.222l2.39-5.078h6.333l2.39 5.078H6.42zm16.58 2.222c0 .408-.33.74-.74.74h-2.126l-2.063-4.385V6.74c0-.408-.33-.74-.74-.74H7.64c-.408 0-.74.332-.74.74v3.537L4.837 14.66H2.71c-.408 0-.74-.332-.74-.74v-9.18c0-.41.33-.74.74-.74h18.52c.41 0 .74.33.74.74v9.18zm-11.4 3.704a2.22 2.22 0 11.002-4.444 2.22 2.22 0 01-.001 4.444z"/></svg>
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-slate-700">Firebase Auth</h2>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-none mt-1">Identity & Security</p>
                            </div>
                        </div>
                        <StatusBadge status={firebaseStatus} error={firebaseError} />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-500">
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35s-8.11-12.78-8.11-12.78L12 2.65l8.11 5.92L12 21.35z"/></svg>
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-slate-700">Supabase DB</h2>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-none mt-1">Database & Storage</p>
                            </div>
                        </div>
                        <StatusBadge status={supabaseStatus} error={supabaseError} />
                    </div>
                </div>

                <div className="mt-10 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <h3 className="text-xs font-bold text-blue-700 uppercase mb-2">Checklist for Success</h3>
                    <ul className="text-[10px] text-blue-600 space-y-1 ml-4 list-disc">
                        <li>Ensure <strong>NEXT_PUBLIC_FIREBASE_API_KEY</strong> is set in <code>.env.local</code></li>
                        <li>Ensure <strong>NEXT_PUBLIC_SUPABASE_URL</strong> matches your dashboard</li>
                        <li>Ensure CORS is configured in Supabase to allow <code>localhost:3000</code></li>
                        <li>Verify your internet connection</li>
                    </ul>
                </div>

                {authDiagnostics && (
                    <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                        <h3 className="text-xs font-bold text-slate-700 uppercase mb-3">Signed-In Auth Diagnostics</h3>
                        <pre className="text-[10px] text-slate-600 whitespace-pre-wrap break-words font-mono">
                            {JSON.stringify(authDiagnostics, null, 2)}
                        </pre>
                    </div>
                )}

                <div className="mt-8 text-center text-[10px] text-slate-400">
                    &copy; {new Date().getFullYear()} Connection Diagnostic Utility
                </div>
            </div>
        </div>
    );
}

export default function DiagnosticsPage() {
    if (process.env.NODE_ENV !== "development") {
        return null;
    }
    return (
        <AdminRoute>
            <ConnectionDiagnostics />
        </AdminRoute>
    );
}

