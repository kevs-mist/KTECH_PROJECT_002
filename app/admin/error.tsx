"use client";

import React, { useEffect } from "react";

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Admin Portal Error:", error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0b0f19] text-white p-6 font-sans">
            <div className="relative max-w-lg w-full bg-[#111827]/80 backdrop-blur-xl border border-white/5 p-8 rounded-3xl shadow-2xl text-center overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-rose-600 to-indigo-500"></div>
                
                <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <svg className="w-8 h-8 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>

                <span className="text-[9px] font-black text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full uppercase tracking-widest">Admin Ops Failure</span>
                <h1 className="text-3xl font-black italic uppercase leading-none mt-4 tracking-tighter">Terminal Exception</h1>
                <p className="text-slate-400 text-sm mt-3 mb-6 leading-relaxed font-medium">
                    An error occurred during administrative state queries. The root cause has been reported to security services.
                </p>

                <div className="bg-black/40 border border-white/5 rounded-xl p-4 mb-8 text-left font-mono text-[10px] text-rose-300 max-h-24 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-slate-800">
                    <span className="font-bold text-rose-400">Exception Message:</span> {error.message || "Unknown admin action crash"}
                </div>

                <div className="space-y-4">
                    <button
                        onClick={() => reset()}
                        className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-lg active:scale-95"
                    >
                        Restart Admin Console
                    </button>
                    <a
                        href="/login"
                        className="block w-full py-3 text-slate-400 hover:text-white font-bold uppercase tracking-widest text-[10px] transition-colors"
                    >
                        Return to Portal Login
                    </a>
                </div>
            </div>
        </div>
    );
}
