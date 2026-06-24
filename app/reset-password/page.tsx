"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail, confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "../src/lib/firebase";
import { ErrorHandler } from "../src/lib/utils/errorHandler";
import { AuthValidator } from "../src/components/Auth/AuthValidator";
import { parseJsonResponse } from "../src/lib/apiClient";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [mode, setMode] = useState<"send_link" | "reset_password">("send_link");
    
    // Form State
    const [email, setEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [oobCode, setOobCode] = useState<string | null>(null);

    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
    const [devLink, setDevLink] = useState<string | null>(null);

    const generateDevResetLink = async (targetEmail: string) => {
        const response = await fetch("/api/auth/password-reset-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: targetEmail }),
        });
        return parseJsonResponse<{ success: boolean; link?: string }>(response, "/api/auth/password-reset-link");
    };

    // Detect if we arrived via a password reset link
    useEffect(() => {
        if (typeof window !== "undefined") {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get("oobCode");
            
            if (code) {
                setOobCode(code);
                setIsLoading(true);
                // Verify the code
                verifyPasswordResetCode(auth, code)
                    .then((verifiedEmail) => {
                        setEmail(verifiedEmail);
                        setMode("reset_password");
                    })
                    .catch(() => {
                        setMessage({ type: "error", text: "Invalid or expired reset link. Please request a new one." });
                        setMode("send_link");
                    })
                    .finally(() => {
                        setIsLoading(false);
                    });
            }
        }
    }, []);

    const handleSendLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);
        setDevLink(null);

        try {
            const actionCodeSettings = {
                url: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : "http://localhost:3000/reset-password",
                handleCodeInApp: true,
            };
            
            // 1. Try to send client-side reset email via Firebase
            await sendPasswordResetEmail(auth, email.trim(), actionCodeSettings);
            setMessage({ type: "success", text: "Password reset link sent! Please check your inbox (including spam folder)." });

            // 2. In development mode, generate a local bypass link
            if (process.env.NODE_ENV === "development") {
                const res = await generateDevResetLink(email.trim());
                if (res.success && res.link) {
                    setDevLink(res.link);
                }
            }
        } catch (err: unknown) {
            console.error("Reset error:", err);
            
            // 3. Fallback to Server Action if client-side failed in dev mode
            if (process.env.NODE_ENV === "development") {
                try {
                    const res = await generateDevResetLink(email.trim());
                    if (res.success && res.link) {
                        setDevLink(res.link);
                        setMessage({ type: "success", text: "Developer Bypass Activated: Server-side reset link generated successfully!" });
                        return;
                    }
                } catch (srvErr: unknown) {
                    console.error("Server Action fallback failed:", srvErr);
                }
            }

            setMessage({ type: "error", text: ErrorHandler.format(err, "Failed to send reset email.") });
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        // Validate passwords
        const passError = AuthValidator.validateStrongPassword(newPassword);
        const matchError = AuthValidator.validateConfirmPassword(newPassword, confirmNewPassword);
        
        if (passError || matchError) {
            setMessage({ type: "error", text: passError || matchError || "Passwords do not match." });
            return;
        }

        if (!oobCode) {
            setMessage({ type: "error", text: "No reset code found. Please request a new link." });
            return;
        }

        setIsLoading(true);
        try {
            await confirmPasswordReset(auth, oobCode, newPassword);
            setMessage({ type: "success", text: "Your password has been successfully reset! Redirecting to login..." });
            
            // Wait 2 seconds, then redirect to login
            setTimeout(() => {
                router.push("/login");
            }, 2000);
            
        } catch (err: unknown) {
            console.error("Reset Password Error:", err);
            setMessage({ type: "error", text: ErrorHandler.format(err, "Failed to reset password.") });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
            <div className="bg-white p-8 md:p-10 rounded-2xl shadow-xl max-w-md w-full border border-slate-200">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Access <span className="text-indigo-600">Recovery</span></h1>
                    <p className="text-sm text-slate-500 mt-2 font-medium">
                        {mode === "send_link" ? "Verify your email to reset your credentials" : `Create a new password for ${email || "your account"}`}
                    </p>
                </div>

                {message && (
                    <div className={`mb-6 p-4 rounded-xl text-xs font-bold border-l-4 ${
                        message.type === "success" ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "bg-red-50 border-red-500 text-red-700"
                    }`}>
                        {message.text}
                    </div>
                )}

                {/* Developer bypass link display */}
                {devLink && mode === "send_link" && (
                    <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-500 text-amber-900 rounded-xl text-xs">
                        <span className="font-black uppercase tracking-widest block text-[9px] text-amber-600 mb-1">🛠️ Developer Bypass:</span>
                        <p className="mb-2">Firebase emails might be delayed or blocked on localhost. Click below to reset immediately:</p>
                        <a 
                            href={devLink} 
                            className="inline-block bg-amber-600 text-white font-bold px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors uppercase tracking-widest text-[9px]"
                        >
                            Reset Password Now 🔑
                        </a>
                    </div>
                )}

                {mode === "send_link" ? (
                    /* --- SEND LINK UI --- */
                    <form className="space-y-6" onSubmit={handleSendLink}>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registered Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                placeholder="name@prime.com"
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
                    </form>
                ) : (
                    /* --- RESET PASSWORD UI --- */
                    <form className="space-y-5" onSubmit={handleConfirmReset}>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                placeholder="••••••••"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                                placeholder="••••••••"
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
                            {isLoading ? "Updating..." : "Update Password"}
                        </button>
                    </form>
                )}

                <div className="text-center pt-6 mt-6 border-t border-slate-100">
                    <a href="/login" className="text-xs font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors">Return to Login</a>
                </div>
            </div>
        </div>
    );
}
