"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../src/lib/AuthContext";
import { employeeService, EmployeeProfile } from "../../src/lib/services/employeeService";
import { supabase } from "../../src/lib/supabase";
import { debounce } from "../../src/lib/utils/debounce";

export default function EngineersPage() {
    const { user, loading: authLoading, logout } = useAuth();
    const router = useRouter();
    const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const fetchEmployees = async () => {
        try {
            setIsLoading(true);
            setFetchError(null);
            const data = await employeeService.getEmployees();
            setEmployees(data);
        } catch (err: any) {
            console.error("Failed to fetch employees", err);
            setFetchError(err.message || "Failed to load engineers.");
        } finally {
            setIsLoading(false);
        }
    };

    const debouncedFetch = React.useMemo(
        () => debounce(async () => {
            if (!user) return;
            try {
                const data = await employeeService.getEmployees();
                setEmployees(data);
            } catch (err: any) {
                console.error("Failed to fetch employees in background", err);
            }
        }, 500),
        [user]
    );

    useEffect(() => {
        if (!authLoading && user) {
            fetchEmployees();
        } else if (!authLoading && !user) {
            setIsLoading(false);
        }
    }, [authLoading, user]);

    // Supabase Realtime Listener
    useEffect(() => {
        if (!user) return;

        // Listen for both employee profile changes (online status) and ticket changes (counts)
        const channel = supabase
            .channel(`engineers-page-${user.uid}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'employees' },
                () => {
                    debouncedFetch();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tickets' },
                () => {
                    debouncedFetch();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, debouncedFetch]);

    const handleLogout = async () => {
        await logout();
        router.push("/login");
    };

    return (
        <div className="min-h-screen font-sans page-enter" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
            {/* Minimalist Top Navigation */}
            <nav className="flex justify-between items-center px-8 py-6 sticky top-0 z-50" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex flex-col">
                    <h1 className="text-xl font-semibold" style={{ letterSpacing: '-0.02em' }}>
                        Admin Suite
                    </h1>
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }}></span>
                        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>System Active</p>
                    </div>
                </div>

                <div className="flex items-center gap-8">
                    {/* Section Nav */}
                    <div className="hidden md:flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                        <Link href="/admin/dashboard" className="text-[11px] font-semibold uppercase tracking-widest px-4 py-2 rounded-md transition-all" style={{ color: 'var(--text-secondary)' }}>
                            Dashboard
                        </Link>
                        <Link href="/admin/engineers" className="text-[11px] font-semibold uppercase tracking-widest px-4 py-2 rounded-md transition-all" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                            Engineers
                        </Link>
                    </div>

                    <div className="hidden md:flex flex-col items-end">
                        <p className="text-xs font-semibold">{user?.email || "Admin User"}</p>
                        <p className="text-[11px] uppercase tracking-widest font-semibold leading-none mt-1" style={{ color: 'var(--accent)' }}>Super Administrator</p>
                    </div>
                    
                    <button 
                        onClick={handleLogout}
                        className="group relative flex items-center gap-2 px-5 py-2.5 rounded-md text-xs font-semibold transition-all"
                        style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                    >
                        <span>Logout</span>
                        <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            </nav>

            <main className="p-8 max-w-7xl mx-auto">
                <div className="flex items-center justify-between mt-8 mb-12">
                    <div>
                        <h2 className="text-2xl font-semibold" style={{ letterSpacing: '-0.02em' }}>Field Engineers</h2>
                        <p className="text-sm mt-1 uppercase tracking-widest font-semibold" style={{ color: 'var(--text-secondary)' }}>Manage and monitor field staff performance</p>
                    </div>
                    <div className="px-6 py-3 rounded-lg flex items-center gap-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                        <div className="text-right">
                            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Active Force</p>
                            <p className="text-xl font-semibold" style={{ letterSpacing: '-0.02em' }}>{employees.filter(e => e.is_online).length}</p>
                        </div>
                        <div className="w-px h-8" style={{ background: 'var(--border-subtle)' }}></div>
                        <div className="text-right">
                            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Total Staff</p>
                            <p className="text-xl font-semibold" style={{ letterSpacing: '-0.02em' }}>{employees.length}</p>
                        </div>
                    </div>
                </div>

                {fetchError && (
                    <div className="mb-8 p-4 text-sm rounded-lg flex items-center gap-3" style={{ background: 'var(--error-soft)', border: '1px solid var(--error)', color: 'var(--error)' }}>
                        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                        <span><strong>Load failed:</strong> {fetchError}</span>
                        <button onClick={fetchEmployees} className="ml-auto text-xs underline" style={{ color: 'var(--error)' }}>Retry</button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isLoading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="p-8 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-14 h-14 rounded-lg" style={{ background: 'var(--bg-elevated)' }} />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 rounded-lg w-3/4" style={{ background: 'var(--bg-elevated)' }} />
                                        <div className="h-3 rounded-lg w-1/2" style={{ background: 'var(--bg-elevated)' }} />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="h-10 rounded-xl w-full" style={{ background: 'var(--bg-elevated)' }} />
                                    <div className="h-10 rounded-xl w-full" style={{ background: 'var(--bg-elevated)' }} />
                                </div>
                            </div>
                        ))
                    ) : employees.length === 0 ? (
                        <div className="col-span-full py-20 text-center rounded-lg" style={{ border: '1px dashed var(--border)', background: 'var(--bg-surface)' }}>
                            <p className="italic uppercase tracking-widest font-semibold text-xs" style={{ color: 'var(--text-secondary)' }}>No engineers found in the system</p>
                        </div>
                    ) : (
                        employees.map((emp) => (
                            <div key={emp.firebase_uid} className="p-8 rounded-lg transition-all group relative overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                <div className="absolute top-0 right-0 w-1 h-full transition-colors" style={{ background: emp.is_online ? 'var(--success)' : 'var(--text-muted)' }}></div>
                                
                                <div className="flex items-center gap-5 mb-8">
                                    <div className="w-16 h-16 rounded-lg flex items-center justify-center text-xl font-semibold relative" style={{ background: emp.is_online ? 'var(--success)' : 'var(--bg-elevated)', color: emp.is_online ? 'white' : 'var(--text-secondary)' }}>
                                        {(emp.full_name || emp.email).substring(0, 2).toUpperCase()}
                                        {emp.is_online && (
                                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full" style={{ background: 'var(--success)', border: '2px solid var(--bg-surface)' }}></span>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold leading-none mb-1">{emp.full_name || "New Engineer"}</h3>
                                        <p className="text-[11px] uppercase font-semibold tracking-widest" style={{ color: 'var(--text-secondary)' }}>{emp.employee_id}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="w-2 h-2 rounded-full" style={{ background: emp.is_online ? 'var(--success)' : 'var(--text-muted)' }}></span>
                                            <span className="text-[11px] uppercase font-semibold tracking-widest" style={{ color: emp.is_online ? 'var(--success)' : 'var(--text-muted)' }}>{emp.is_online ? 'Online' : 'Offline'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="p-4 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                                        <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-secondary)' }}>Active</p>
                                        <p className="text-xl font-semibold" style={{ letterSpacing: '-0.02em', color: 'var(--warning)' }}>{emp.active_tickets}</p>
                                    </div>
                                    <div className="p-4 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                                        <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-secondary)' }}>Closed</p>
                                        <p className="text-xl font-semibold" style={{ letterSpacing: '-0.02em', color: 'var(--success)' }}>{emp.closed_tickets}</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-widest px-1" style={{ color: 'var(--text-secondary)' }}>Dept: {emp.department || "Field Force"}</p>
                                    <p className="text-[11px] font-semibold uppercase tracking-widest px-1" style={{ color: 'var(--text-secondary)' }}>Joined: {new Date(emp.joined_at).toLocaleDateString()}</p>
                                </div>
                                
                                <button className="w-full mt-6 py-3.5 rounded-md text-[11px] font-semibold uppercase tracking-widest transition-all" style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                    View Performance
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
