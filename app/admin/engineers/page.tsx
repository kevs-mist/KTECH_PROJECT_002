"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../src/lib/AuthContext";
import { employeeService, EmployeeProfile } from "../../src/lib/services/employeeService";
import { supabase } from "../../src/lib/supabase";
import { debounce } from "../../src/lib/utils/debounce";

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Failed to load engineers.";
}

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
        } catch (err: unknown) {
            console.error("Failed to fetch employees", err);
            setFetchError(getErrorMessage(err));
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
            } catch (err: unknown) {
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
            .channel('engineers-db-changes')
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
        <div className="min-h-screen bg-[#0f172a] text-white font-sans selection:bg-indigo-500/30">
            {/* Minimalist Top Navigation */}
            <nav className="flex justify-between items-center px-8 py-6 border-b border-white/5 backdrop-blur-md sticky top-0 z-50">
                <div className="flex flex-col">
                    <h1 className="text-xl font-black tracking-tighter uppercase italic group">
                        Admin <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 group-hover:from-cyan-400 group-hover:to-indigo-400 transition-all duration-500">Suite</span>
                    </h1>
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">System Active</p>
                    </div>
                </div>

                <div className="flex items-center gap-8">
                    {/* Section Nav */}
                    <div className="hidden md:flex items-center gap-1 bg-white/5 rounded-xl p-1">
                        <Link href="/admin/dashboard" className="text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                            Dashboard
                        </Link>
                        <Link href="/admin/engineers" className="text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg bg-white/10 text-white transition-all">
                            Engineers
                        </Link>
                    </div>

                    <div className="hidden md:flex flex-col items-end">
                        <p className="text-xs font-bold text-slate-200">{user?.email || "Admin User"}</p>
                        <p className="text-[9px] text-indigo-400 uppercase tracking-widest font-black leading-none mt-1">Super Administrator</p>
                    </div>
                    
                    <button 
                        onClick={handleLogout}
                        className="group relative flex items-center gap-2 bg-white/5 hover:bg-red-500/10 text-white/50 hover:text-red-400 border border-white/10 hover:border-red-500/20 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300"
                    >
                        <span>Logout</span>
                        <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            </nav>

            <main className="p-8 max-w-7xl mx-auto">
                <div className="flex items-center justify-between mt-8 mb-12">
                    <div>
                        <h2 className="text-3xl font-black italic uppercase tracking-tighter">Field Engineers</h2>
                        <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest font-bold">Manage and monitor field staff performance</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Active Force</p>
                            <p className="text-xl font-black italic">{employees.filter(e => e.is_online).length}</p>
                        </div>
                        <div className="w-px h-8 bg-white/10"></div>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Total Staff</p>
                            <p className="text-xl font-black italic">{employees.length}</p>
                        </div>
                    </div>
                </div>

                {fetchError && (
                    <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-2xl flex items-center gap-3">
                        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                        <span><strong>Load failed:</strong> {fetchError}</span>
                        <button onClick={fetchEmployees} className="ml-auto text-xs underline hover:text-red-300">Retry</button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isLoading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="bg-white/[0.03] border border-white/10 p-8 rounded-[2rem] animate-pulse">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-14 h-14 bg-white/5 rounded-2xl" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-white/5 rounded-lg w-3/4" />
                                        <div className="h-3 bg-white/5 rounded-lg w-1/2" />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="h-10 bg-white/5 rounded-xl w-full" />
                                    <div className="h-10 bg-white/5 rounded-xl w-full" />
                                </div>
                            </div>
                        ))
                    ) : employees.length === 0 ? (
                        <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.01]">
                            <p className="text-slate-500 italic uppercase tracking-widest font-bold text-xs">No engineers found in the system</p>
                        </div>
                    ) : (
                        employees.map((emp) => (
                            <div key={emp.firebase_uid} className="bg-white/[0.03] border border-white/10 p-8 rounded-[2rem] hover:bg-white/[0.05] transition-all group relative overflow-hidden">
                                <div className={`absolute top-0 right-0 w-1 h-full ${emp.is_online ? 'bg-emerald-500' : 'bg-slate-700'} transition-colors`}></div>
                                
                                <div className="flex items-center gap-5 mb-8">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black italic shadow-lg ${emp.is_online ? 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-500/20' : 'bg-gradient-to-br from-slate-600 to-slate-700 shadow-black/20 opacity-60'}`}>
                                        {(emp.full_name || emp.email).substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-white leading-none mb-1">{emp.full_name || "New Engineer"}</h3>
                                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em]">{emp.employee_id}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`w-1.5 h-1.5 rounded-full ${emp.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></span>
                                            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">{emp.is_online ? 'Online' : 'Offline'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Active</p>
                                        <p className="text-xl font-black text-amber-400 italic">{emp.active_tickets}</p>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Closed</p>
                                        <p className="text-xl font-black text-emerald-400 italic">{emp.closed_tickets}</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Dept: {emp.department || "Field Force"}</p>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Joined: {new Date(emp.joined_at).toLocaleDateString()}</p>
                                </div>
                                
                                <button className="w-full mt-6 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] bg-white/5 group-hover:bg-indigo-600 group-hover:text-white transition-all border border-white/5">
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
