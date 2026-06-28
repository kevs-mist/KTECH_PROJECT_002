"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useRegisterServiceProvider } from "./Register_sevice_provider";
import { AuthValidator } from "../../Auth/AuthValidator";

/**
 * Register
 * 
 * Registration portal for Prime Services CRM.
 * Default registration → Employee role (immediate access to employee dashboard).
 * Admin access requested → Pending user (stays in user table until admin approves).
 */
export default function Register() {
    const { register, isLoading, error: serverError } = useRegisterServiceProvider();
    const router = useRouter();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isAdminRequested, setIsAdminRequested] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError(null);

        const errorMsg = AuthValidator.validateRegistration(email, password, confirmPassword, name);
        if (errorMsg) {
            setValidationError(errorMsg);
            return;
        }

        const res = await register(email, password, name, isAdminRequested);

        if (res.success) {
            if (res.user?.role === "admin") {
                router.push("/admin/dashboard");
            } else if (res.user?.role === "employee") {
                router.push("/employee/dashboard");
            } else {
                // Pending admin request — user role, show a message or go to a waiting page
                router.push("/login");
            }
        }
    };

    const displayError = validationError || serverError;

    return (
        <div className="register-container min-h-screen flex items-center justify-center p-4 safe-top" style={{ background: 'var(--bg-base)' }}>
            <div className="register-box p-6 md:p-8 md:p-10 max-w-md w-full relative overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>

                <div className="absolute top-0 left-0 w-full h-1.5" style={{ background: 'linear-gradient(to right, var(--success), var(--accent), var(--success))' }}></div>

                <div className="register-header mb-6 md:mb-8 flex flex-col items-center">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                        <svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                        </svg>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-center tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        Join <span style={{ color: 'var(--success)' }}>Prime Services CRM</span>
                    </h1>
                    <p className="text-center text-xs md:text-sm mt-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Register as a Field Engineer</p>
                </div>

                <div className="register-body relative z-10">
                    {displayError && (
                        <div id="register-error-msg" role="alert" aria-live="assertive" className="mb-6 p-4 rounded shadow-sm text-xs flex items-center gap-3" style={{ background: 'var(--error-soft)', borderLeft: '4px solid var(--error)', color: 'var(--error)' }}>
                            <span className="flex-1">{displayError}</span>
                        </div>
                    )}

                    <form className="space-y-4" onSubmit={handleRegister}>
                        <div className="form-group flex flex-col group">
                            <label htmlFor="name" className="text-[10px] font-bold mb-1.5 uppercase tracking-widest transition-colors" style={{ color: 'var(--text-tertiary)' }}>
                                Full Name
                            </label>
                            <input
                                type="text" id="name" value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full rounded-lg px-4 py-3 min-h-[48px] outline-none transition-all shadow-sm text-sm"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                required placeholder="John Doe" disabled={isLoading}
                                aria-describedby={displayError ? "register-error-msg" : undefined}
                                aria-invalid={!!displayError}
                            />
                        </div>

                        <div className="form-group flex flex-col group">
                            <label htmlFor="email" className="text-[10px] font-bold mb-1.5 uppercase tracking-widest transition-colors" style={{ color: 'var(--text-tertiary)' }}>
                                Email Address
                            </label>
                            <input
                                type="email" id="email" value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded-lg px-4 py-3 min-h-[48px] outline-none transition-all shadow-sm text-sm"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                required placeholder="john@example.com" disabled={isLoading}
                                aria-describedby={displayError ? "register-error-msg" : undefined}
                                aria-invalid={!!displayError}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="form-group flex flex-col group">
                                <label htmlFor="password" className="text-[10px] font-bold mb-1.5 uppercase tracking-widest transition-colors" style={{ color: 'var(--text-tertiary)' }}>
                                    Password
                                </label>
                                <input
                                    type="password" id="password" value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full rounded-lg px-4 py-3 min-h-[48px] outline-none transition-all shadow-sm text-sm"
                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                    required placeholder="••••••••" disabled={isLoading}
                                    aria-describedby={displayError ? "register-error-msg" : undefined}
                                    aria-invalid={!!displayError}
                                />
                            </div>

                            <div className="form-group flex flex-col group">
                                <label htmlFor="confirmPassword" className="text-[10px] font-bold mb-1.5 uppercase tracking-widest transition-colors" style={{ color: 'var(--text-tertiary)' }}>
                                    Confirm
                                </label>
                                <input
                                    type="password" id="confirmPassword" value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full rounded-lg px-4 py-3 min-h-[48px] outline-none transition-all shadow-sm text-sm"
                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                    required placeholder="••••••••" disabled={isLoading}
                                    aria-describedby={displayError ? "register-error-msg" : undefined}
                                    aria-invalid={!!displayError}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 mt-2 mb-4 p-3 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                            <input
                                type="checkbox" id="adminRequest"
                                checked={isAdminRequested}
                                onChange={(e) => setIsAdminRequested(e.target.checked)}
                                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                disabled={isLoading}
                            />
                            <div>
                                <label htmlFor="adminRequest" className="text-xs font-bold block" style={{ color: 'var(--text-primary)' }}>
                                    Request Admin Access
                                </label>
                                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Your account will be pending until an admin approves you.</p>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full mt-4 text-white py-4 min-h-[52px] rounded-xl font-bold shadow-xl active:scale-95 transition-transform"
                            style={{
                                background: isLoading ? 'var(--border)' : 'linear-gradient(to right, var(--success), var(--accent))',
                                cursor: isLoading ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {isLoading ? "Provisioning..." : "Create Account"}
                        </button>

                        <div className="existing_account mt-6 md:mt-8 text-center text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                            Already have an account? <a href="/login" className="font-bold underline underline-offset-4" style={{ color: 'var(--success)', textDecorationColor: 'var(--success-soft)' }}>Log in</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
