"use client";

import React, { useEffect } from "react";

export default function EmployeeError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Employee Portal Error:", error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 p-4 font-sans safe-top">
            <div className="relative max-w-md w-full bg-white border border-slate-100 p-6 md:p-8 rounded-3xl shadow-2xl text-center overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-500"></div>

                <div className="w-14 h-14 md:w-16 md:h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-inner animate-pulse">
                    <svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>

                <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-widest">Engineer Portal Error</span>
                <h1 className="text-2xl md:text-3xl font-black italic uppercase leading-none mt-4 tracking-tighter">Connection Fault</h1>
                <p className="text-slate-500 text-xs md:text-sm mt-3 mb-6 leading-relaxed font-medium">
                    An error occurred while fetching or updating active work tickets. Please retry or contact dispatch.
                </p>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-6 md:mb-8 text-left font-mono text-[10px] text-slate-500 max-h-24 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-slate-200">
                    <span className="font-bold text-slate-700">Diagnostic Info:</span> {error.message || "Failed to load dashboard components"}
                </div>

                <div className="space-y-4">
                    <button
                        onClick={() => reset()}
                        className="w-full py-4 min-h-[52px] bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg active:scale-95 transition-transform"
                    >
                        Retry Active Session
                    </button>
                    <a
                        href="/login"
                        className="block w-full py-4 min-h-[52px] text-slate-400 font-bold uppercase tracking-widest text-[10px] transition-colors"
                    >
                        Sign In Again
                    </a>
                </div>
            </div>
        </div>
    );
}
