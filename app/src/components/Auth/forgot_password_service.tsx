"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail, confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { AuthValidator } from "./AuthValidator";
import { ErrorHandler } from "../../lib/utils/errorHandler";

export default function ForgotPassword() {
    const router = useRouter();

    // UI State
    const [mode, setMode] = useState<"send_link" | "reset_password">("send_link");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);

    // Form Data
    const [email, setEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");

    // Firebase Reset Code (from URL)
    const [oobCode, setOobCode] = useState<string | null>(null);

    useEffect(() => {
        // Detect if the user arrived via an email link (it will have an oobCode query param)
        if (typeof window !== "undefined") {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get("oobCode");
            if (code) {
                setOobCode(code);
                setIsLoading(true);
                // try to verify the code from the mail
                verifyPasswordResetCode(auth, code)
                    .then((verifiedEmail) => {
                        setEmail(verifiedEmail); // Show them which email is being reset
                        setMode("reset_password");
                    })
                    .catch((err) => {
                        setError("Invalid or expired reset link. Please request a new one.");
                        setMode("send_link");
                    })
                    .finally(() => {
                        setIsLoading(false);
                    });
            }
        }
    }, []);

    useEffect(() => {
        if (countdown !== null) {
            if (countdown <= 0) {
                router.push("/login");
                return;
            }
            const timer = setTimeout(() => {
                setCountdown(countdown - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown, router]);

    const handleSendLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);

        const emailError = AuthValidator.validateEmail(email);
        if (emailError) {
            setError(emailError);
            return;
        }

        setIsLoading(true);
        try {
            const actionCodeSettings = {
                url: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : "http://localhost:3000/reset-password",
                handleCodeInApp: true,
            };
            
            await sendPasswordResetEmail(auth, email, actionCodeSettings);
            setSuccessMsg(`A password reset link has been sent to ${email}`);
        } catch (err: any) {
            console.warn("Forgot Password Error:", err.message);
            setError(ErrorHandler.format(err, "Failed to send reset email."));
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);

        // Validation
        const passError = AuthValidator.validateStrongPassword(newPassword);
        const matchError = AuthValidator.validateConfirmPassword(newPassword, confirmNewPassword);
        if (passError || matchError) {
            setError(passError || matchError);
            return;
        }

        if (!oobCode) {
            setError("No reset code found in the URL.");
            return;
        }

        setIsLoading(true);
        try {
            await confirmPasswordReset(auth, oobCode, newPassword);
            setSuccessMsg("Your password has been successfully reset!");
            setCountdown(5);
        } catch (err: any) {
            console.warn("Reset Password Error:", err.message);
            setError(ErrorHandler.format(err, "Failed to reset password."));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container pb-12">
            <div className="login-box bg-white p-8 rounded shadow-md max-w-sm mx-auto mt-20 text-slate-900 border border-slate-200">
                <div className="login-header mb-6">
                    <h1 className="text-3xl font-bold text-center tracking-tight text-blue-600">
                        {mode === "send_link" ? "Forgot Password" : "Reset Password"}
                    </h1>
                    <p className="text-center text-sm text-slate-500 mt-2">
                        {mode === "send_link"
                            ? "Enter your email to receive a reset link."
                            : `Create a new password for ${email || "your account"}.`}
                    </p>
                </div>

                <div className="login-body">
                    {successMsg && countdown !== null ? (
                        <div role="status" aria-live="polite" className="mb-4 p-4 bg-green-50 text-green-700 rounded text-sm text-center flex flex-col items-center gap-2 border border-green-200">
                            <span className="font-bold">{successMsg}</span>
                            <div className="flex flex-col items-center gap-1 mt-1">
                                <span className="text-xs text-slate-500">Redirecting to login in <strong className="text-green-700">{countdown}</strong> seconds...</span>
                                <button
                                    type="button"
                                    onClick={() => router.push("/login")}
                                    className="text-xs text-blue-600 mt-2 font-bold uppercase tracking-wider"
                                >
                                    Go to Login Now
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* UI Feedback */}
                            {error && (
                                <div id="forgot-error-msg" role="alert" aria-live="assertive" className="mb-4 p-3 bg-red-50 text-red-600 rounded text-sm text-center">
                                    {error}
                                </div>
                            )}
                            {successMsg && (
                                <div role="status" aria-live="polite" className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm text-center">
                                    {successMsg}
                                </div>
                            )}

                            {/* DUAL MODE FORM RENDER */}
                            {mode === "send_link" ? (
                                /* --- SEND LINK UI --- */
                                <form className="space-y-4" onSubmit={handleSendLink}>
                                    <div className="form-group flex flex-col">
                                        <label htmlFor="email" className="text-sm font-semibold mb-1">Email Address</label>
                                        <input
                                            type="email"
                                            id="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="border border-slate-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-sm"
                                            required
                                            placeholder="your@email.com"
                                            aria-describedby={error ? "forgot-error-msg" : undefined}
                                            aria-invalid={!!error}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className={`w-full text-white py-2.5 rounded font-medium shadow-sm transition ${isLoading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 active:scale-[0.98]"}`}
                                    >
                                        {isLoading ? "Sending..." : "Send Reset Link"}
                                    </button>
                                    <div className="text-center text-sm mt-4 text-slate-600">
                                        <p>Remember your password? <a href="/login" className="text-blue-600">Log in</a></p>
                                    </div>
                                </form>
                            ) : (
                                /* --- REST PASSWORD UI --- */
                                <form className="space-y-4" onSubmit={handleResetPassword}>
                                    <div className="form-group flex flex-col">
                                        <label htmlFor="newPassword" className="text-sm font-semibold mb-1">New Password</label>
                                        <input
                                            type="password"
                                            id="newPassword"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="border border-slate-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-sm"
                                            required
                                            minLength={8}
                                            aria-describedby={error ? "forgot-error-msg" : undefined}
                                            aria-invalid={!!error}
                                        />
                                    </div>
                                    <div className="form-group flex flex-col">
                                        <label htmlFor="confirmNewPassword" className="text-sm font-semibold mb-1">Confirm New Password</label>
                                        <input
                                            type="password"
                                            id="confirmNewPassword"
                                            value={confirmNewPassword}
                                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                                            className="border border-slate-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-sm"
                                            required
                                            minLength={8}
                                            aria-describedby={error ? "forgot-error-msg" : undefined}
                                            aria-invalid={!!error}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className={`w-full text-white py-2.5 rounded font-medium shadow-sm transition ${isLoading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 active:scale-[0.98]"}`}
                                    >
                                        {isLoading ? "Resetting..." : "Save New Password"}
                                    </button>
                                </form>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}