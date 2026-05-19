"use client";

import React, { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../src/lib/firebase";

export default function ResetPasswordPage() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            await sendPasswordResetEmail(auth, email.trim());
            setMessage({ type: "success", text: "Password reset link sent! Please check your inbox." });
        } catch (err: any) {
            console.error("Reset error:", err);
            setMessage({ type: "error", text: err.message || "Failed to send reset email." });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
            <div className="bg-white p-8 md:p-10 rounded-2xl shadow-xl max-w-md w-full border border-slate-200">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Access <span className="text-indigo-600">Recovery</span></h1>
                    <p className="text-sm text-slate-500 mt-2 font-medium">Verify your email to reset your credentials</p>
                </div>

                {message && (
                    <div className={`mb-6 p-4 rounded-xl text-xs font-bold border-l-4 ${
                        message.type === "success" ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "bg-red-50 border-red-500 text-red-700"
                    }`}>
                        {message.text}
                    </div>
                )}

                <form className="space-y-6" onSubmit={handleReset}>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registered Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                            placeholder="name@ktech.com"
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full py-3.5 rounded-xl text-white font-bold shadow-lg transition-all transform active:scale-95 ${
                            isLoading ? "bg-slate-300" : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20"
                        }`}
                    >
                        {isLoading ? "Processing..." : "Send Recovery Link"}
                    </button>

                    <div className="text-center pt-4 border-t border-slate-100">
                        <a href="/login" className="text-xs font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors">Return to Login</a>
                    </div>
                </form>
            </div>
        </div>
    );
}
