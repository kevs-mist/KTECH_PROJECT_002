"use client";

import React from "react";
import { useAuth } from "../../src/lib/AuthContext";

export default function AdminDashboard() {
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <nav className="flex justify-between items-center mb-12 border-b border-slate-800 pb-6">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tighter italic">Admin <span className="text-indigo-400">Hub</span></h1>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">System Management Console</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-xs font-bold">{user?.email}</p>
                        <p className="text-[10px] text-indigo-400 uppercase tracking-widest">Administrator</p>
                    </div>
                    <button 
                        onClick={() => logout()}
                        className="bg-slate-800 hover:bg-red-500/20 hover:text-red-400 border border-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition-all"
                    >
                        Terminiate Session
                    </button>
                </div>
            </nav>

            <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Site Traffic</h3>
                    <p className="text-4xl font-black italic">1,280 <span className="text-indigo-400 text-sm not-italic">UV</span></p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Pending Access</h3>
                    <p className="text-4xl font-black italic">12 <span className="text-indigo-400 text-sm not-italic">REQS</span></p>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">System Load</h3>
                    <p className="text-4xl font-black italic">0.04 <span className="text-indigo-400 text-sm not-italic">LA</span></p>
                </div>
            </main>

            <div className="mt-12 bg-indigo-600 p-8 rounded-3xl shadow-2xl shadow-indigo-500/20 relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-3xl font-black italic mb-2">Welcome to the Command Center</h2>
                    <p className="text-indigo-100 max-w-lg text-sm">All administrative tools are now active. You have full oversight of the KTech Field CRM infrastructure.</p>
                </div>
                <div className="absolute top-0 right-0 p-8 opacity-20 transform translate-x-1/4 -translate-y-1/4">
                    <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                </div>
            </div>
        </div>
    );
}
