"use client";

import React from "react";
import { useAuth } from "../src/lib/AuthContext";

export default function UserDashboard() {
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <nav className="flex justify-between items-center mb-12 border-b border-indigo-100 pb-6">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tighter italic text-indigo-600">My <span className="text-blue-700">CRM</span></h1>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold">Client Portal</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-xs font-bold text-slate-800">{user?.email}</p>
                        <p className="text-[10px] text-indigo-600 uppercase tracking-widest font-bold">Account Holder</p>
                    </div>
                    <button 
                        onClick={() => logout()}
                        className="bg-white hover:bg-slate-50 border border-slate-200 px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
                    >
                        Sign Out
                    </button>
                </div>
            </nav>

            <div className="max-w-4xl mx-auto mt-20 text-center">
                <div className="bg-white p-16 rounded-[3rem] shadow-2xl shadow-indigo-500/10 border border-indigo-50/50">
                    <div className="w-20 h-20 bg-indigo-50 rounded-3xl mx-auto flex items-center justify-center text-indigo-600 mb-8">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0116 0z"/></svg>
                    </div>
                    <h2 className="text-4xl font-black text-slate-800 tracking-tight mb-4 italic">Welcome Back!</h2>
                    <p className="text-slate-500 text-lg max-w-md mx-auto leading-relaxed">
                        Your account is active. Start exploring your personalized Field CRM dashboard today.
                    </p>
                    <div className="mt-10 flex gap-4 justify-center">
                        <button className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-bold hover:bg-indigo-500 transition shadow-lg shadow-indigo-500/20">Explore Features</button>
                        <button className="bg-slate-100 text-slate-700 px-8 py-3.5 rounded-2xl font-bold hover:bg-slate-200 transition">View Profile</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
