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

    const sendAlternativeEmail = async (targetEmail: string, resetLink: string) => {
        const response = await fetch("/api/auth/password-reset-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: targetEmail, resetLink }),
        });
        return parseJsonResponse<{ success: boolean }>(response, "/api/auth/password-reset-email");
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
            const resetUrl = typeof window !== "undefined" ? `${window.location.origin}/reset-password` : "http://localhost:3000/reset-password";
            
            console.log("Sending password reset to:", email.trim(), "with URL:", resetUrl);
            
            // 1. Try to send client-side reset email via Firebase (without actionCodeSettings for now)
            await sendPasswordResetEmail(auth, email.trim());
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
            
            // Log detailed error information
            if (err instanceof Error) {
                console.error("Error code:", (err as any).code);
                console.error("Error message:", err.message);
            }
            
            // 3. Fallback to alternative email service (Resend) if Firebase fails
            try {
                const resetUrl = typeof window !== "undefined" ? `${window.location.origin}/reset-password` : "http://localhost:3000/reset-password";
                const altRes = await sendAlternativeEmail(email.trim(), resetUrl);
                if (altRes.success) {
                    setMessage({ type: "success", text: "Password reset link sent via alternative email service. Please check your inbox." });
                    return;
                }
            } catch (altErr: unknown) {
                console.error("Alternative email service failed:", altErr);
            }
            
            // 4. Fallback to Server Action if client-side failed in dev mode
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

            setMessage({ type: "error", text: ErrorHandler.format(err, "Failed to send reset email. Please try again later.") });
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
        <div className="min-h-screen flex items-center justify-center p-4 safe-top" style={{ background: 'var(--bg-base)' }}>
            <div className="p-6 md:p-8 md:p-10 rounded-2xl shadow-xl max-w-md w-full" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="mb-6 md:mb-8 text-center">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Access <span style={{ color: 'var(--accent)' }}>Recovery</span></h1>
                    <p className="text-xs md:text-sm mt-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {mode === "send_link" ? "Verify your email to reset your credentials" : `Create a new password for ${email || "your account"}`}
                    </p>
                </div>

                {message && (
                    <div className="mb-6 p-4 rounded-xl text-xs font-semibold border-l-4" style={{
                        background: message.type === "success" ? 'var(--success-soft)' : 'var(--error-soft)',
                        borderColor: message.type === "success" ? 'var(--success)' : 'var(--error)',
                        color: message.type === "success" ? 'var(--success)' : 'var(--error)'
                    }}>
                        {message.text}
                    </div>
                )}

                {/* Developer bypass link display */}
                {devLink && mode === "send_link" && (
                    <div className="mb-6 p-4 rounded-xl text-xs" style={{ background: 'var(--warning-soft)', borderLeft: '4px solid var(--warning)', color: 'var(--text-primary)' }}>
                        <span className="font-semibold uppercase tracking-widest block text-[9px] mb-1" style={{ color: 'var(--warning)' }}>🛠️ Developer Bypass:</span>
                        <p className="mb-2">Firebase emails might be delayed or blocked on localhost. Click below to reset immediately:</p>
                        <a
                            href={devLink}
                            className="inline-block font-semibold px-3 py-1.5 min-h-[44px] rounded-lg transition-colors uppercase tracking-widest text-[9px]"
                            style={{ background: 'var(--warning)', color: 'white' }}
                        >
                            Reset Password Now 🔑
                        </a>
                    </div>
                )}

                {mode === "send_link" ? (
                    /* --- SEND LINK UI --- */
                    <form className="space-y-6" onSubmit={handleSendLink}>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Registered Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="px-4 py-3 min-h-[48px] rounded-lg outline-none transition-all text-sm"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                placeholder="name@prime.com"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 min-h-[52px] rounded-xl font-semibold shadow-lg active:scale-95 transition-transform"
                            style={{
                                color: 'white',
                                background: isLoading ? 'var(--text-tertiary)' : 'var(--accent)',
                                boxShadow: isLoading ? 'none' : 'var(--accent) 0 10px 15px -3px'
                            }}
                        >
                            {isLoading ? "Processing..." : "Send Recovery Link"}
                        </button>
                    </form>
                ) : (
                    /* --- RESET PASSWORD UI --- */
                    <form className="space-y-6" onSubmit={handleConfirmReset}>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="px-4 py-3 min-h-[48px] rounded-lg outline-none transition-all text-sm"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                placeholder="••••••••"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Confirm Password</label>
                            <input
                                type="password"
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                className="px-4 py-3 min-h-[48px] rounded-lg outline-none transition-all text-sm"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                placeholder="••••••••"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 min-h-[52px] rounded-xl font-semibold shadow-lg active:scale-95 transition-transform"
                            style={{
                                color: 'white',
                                background: isLoading ? 'var(--text-tertiary)' : 'var(--accent)',
                                boxShadow: isLoading ? 'none' : 'var(--accent) 0 10px 15px -3px'
                            }}
                        >
                            {isLoading ? "Updating..." : "Update Password"}
                        </button>
                    </form>
                )}

                <div className="text-center pt-6 mt-6" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <a href="/login" className="text-xs font-semibold uppercase tracking-widest transition-colors py-2 min-h-[44px] inline-block" style={{ color: 'var(--text-tertiary)' }}>Return to Login</a>
                </div>
            </div>
        </div>
    );
}
