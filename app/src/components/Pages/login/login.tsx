"use client";

import React, { useState } from "react";
import { useLoginServiceProvider } from "./login_service_provider";
import { AuthValidator } from "../../Auth/AuthValidator";

/**
 * Login
 * 
 * Unified login portal for KTech Field CRM.
 * Handles both Staff and Admin authentication.
 */
export default function Login() {
    const { login, verifyAdminOtp, isLoading, error: serverError } = useLoginServiceProvider();
    
    // Auth States
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [otp, setOtp] = useState("");
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [awaitingOtp, setAwaitingOtp] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError(null);
        setInfoMessage(null);

        // Phase 2: OTP Verification
        if (awaitingOtp) {
            if (!otp.trim()) {
                return setValidationError("Security Code is required.");
            }
            await verifyAdminOtp(otp);
            return;
        }
        
        // Phase 1: Credentials Verification
        const emailError = AuthValidator.validateEmail(username);
        if (emailError) return setValidationError(emailError);

        const passError = AuthValidator.validatePassword(password);
        if (passError) return setValidationError(passError);

        const res = await login(username, password, isAdminMode);
        
        if (res?.success && res.requires_otp) {
            setAwaitingOtp(true);
            setIsAdminMode(true);
            setInfoMessage("Admin account verified. Enter your Security Code below.");
        }
    };

    const displayError = serverError || validationError;
    const displayInfo = infoMessage;

    return (
        <div className="login-container min-h-screen flex items-center justify-center p-4 page-enter safe-top" style={{ background: 'var(--bg-base)' }}>
            <div className="login-box p-6 md:p-8 md:p-10 max-w-md w-full relative overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>

                <div className="absolute top-0 left-0 w-full h-1" style={{ background: 'var(--accent)' }}></div>

                <div className="login-header mb-6 md:mb-8 flex flex-col items-center">
                    <img
                        src="/images/prime_services_logo.png?v=1"
                        alt="Prime Services ATM Services & Maintenance"
                        loading="lazy"
                        className="w-16 h-16 md:w-20 md:h-20 object-contain mb-4"
                    />
                    <h1 className="text-xl md:text-2xl font-semibold text-center" style={{ letterSpacing: '-0.02em' }}>
                        Staff Portal
                    </h1>
                    <p className="text-center text-xs md:text-sm mt-2 font-mono" style={{ color: 'var(--text-secondary)' }}>
                        FIELD OPERATIONS LOGIN
                    </p>
                </div>

                <div className="login-body relative z-10">
                    {displayError && (
                        <div id="login-error-msg" role="alert" aria-live="assertive" className="mb-6 p-4 rounded text-[11px] uppercase font-semibold flex items-center gap-3" style={{ background: 'var(--error-soft)', border: '1px solid var(--error)', color: 'var(--error)' }}>
                            <span className="flex-1">{displayError}</span>
                        </div>
                    )}

                    {displayInfo && (
                        <div role="status" aria-live="polite" className="mb-6 p-4 rounded text-[11px] uppercase font-semibold flex items-center gap-3" style={{ background: 'var(--success-soft)', border: '1px solid var(--success)', color: 'var(--success)' }}>
                            <span className="flex-1">{displayInfo}</span>
                        </div>
                    )}

                    <form className="space-y-4" onSubmit={handleLogin}>
                        <div className="form-group flex flex-col group">
                            <label htmlFor="staff-email" className="text-[11px] font-semibold mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Staff Email</label>
                            <input
                                id="staff-email"
                                type="email"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full rounded-lg px-4 py-3 min-h-[48px] outline-none focus:ring-0 transition-all text-sm"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                placeholder="name@prime.com"
                                required
                                disabled={isLoading || awaitingOtp}
                                aria-describedby={displayError ? "login-error-msg" : undefined}
                                aria-invalid={!!displayError}
                            />
                        </div>
                        <div className="form-group flex flex-col group">
                            <label htmlFor="access-password" className="text-[11px] font-semibold mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Access Password</label>
                            <input
                                id="access-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-lg px-4 py-3 min-h-[48px] outline-none focus:ring-0 transition-all text-sm"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                placeholder="••••••••"
                                required
                                disabled={isLoading || awaitingOtp}
                                aria-describedby={displayError ? "login-error-msg" : undefined}
                                aria-invalid={!!displayError}
                            />
                        </div>

                        {isAdminMode && (
                            <div className="form-group flex flex-col group mt-4">
                                <label htmlFor="security-code" className="text-[11px] font-semibold mb-1.5 uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Security Code (Required for Admin)</label>
                                <input
                                    id="security-code"
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    className="w-full rounded-lg px-4 py-3 min-h-[48px] outline-none focus:ring-0 transition-all font-medium tracking-widest text-sm"
                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent)', color: 'var(--text-primary)' }}
                                    placeholder="Enter 6-digit code"
                                    required={isAdminMode}
                                    disabled={isLoading}
                                    autoFocus
                                    aria-describedby={displayError ? "login-error-msg" : undefined}
                                    aria-invalid={!!displayError}
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full mt-2 py-4 min-h-[52px] font-semibold transition-all"
                            style={{ background: isLoading ? 'var(--text-muted)' : 'var(--accent)', color: 'white', borderRadius: '6px' }}
                        >
                            {isLoading ? "Authenticating..." : awaitingOtp ? "Verify Security Code" : isAdminMode ? "Sign In as Admin" : "Sign In & Access Workspace"}
                        </button>
                    </form>

                    <div className="mt-6 md:mt-8 pt-6 flex flex-col gap-4 text-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        {!isAdminMode && (
                            <button
                                type="button"
                                onClick={() => setIsAdminMode(true)}
                                className="text-[11px] font-semibold uppercase tracking-widest transition-colors py-2 min-h-[44px]"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                Enter as Administrator
                            </button>
                        )}
                        <div className="flex items-center justify-between px-2">
                            <a href="/register" className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Register Account</a>
                            <a href="/reset-password" className="text-[11px] font-semibold uppercase tracking-wider transition-colors" style={{ color: 'var(--text-secondary)' }}>Forgot Password?</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
