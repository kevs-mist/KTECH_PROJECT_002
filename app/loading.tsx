"use client";

import React from "react";

export default function Loading() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 p-6 font-sans">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
                <div className="flex flex-col items-center gap-1">
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">Connecting Core</p>
                    <p className="text-[8px] text-slate-400 font-medium uppercase tracking-widest animate-pulse">Synchronizing Security Tokens...</p>
                </div>
            </div>
        </div>
    );
}
