"use client";

import React from "react";

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6 font-sans">
            <div className="relative max-w-md w-full bg-slate-900/50 backdrop-blur-xl border border-white/5 p-8 rounded-3xl shadow-2xl text-center overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-500"></div>
                
                <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>

                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-3 py-1 rounded-full">Error 404</span>
                <h1 className="text-3xl font-black italic uppercase leading-none mt-4 tracking-tighter">Sector Not Found</h1>
                <p className="text-slate-500 text-sm mt-3 mb-8 leading-relaxed font-medium">
                    The requested coordinates or interface path does not exist on the current Prime Services grid.
                </p>

                <a
                    href="/login"
                    className="inline-block w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-lg shadow-indigo-900/20 active:scale-95"
                >
                    Return to Portal
                </a>
            </div>
        </div>
    );
}
