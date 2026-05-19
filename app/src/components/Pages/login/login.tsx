"use client";

import React, { useState } from "react";
import { login_service_provider } from "./login_service_provider";
import { AuthValidator } from "../../Auth/AuthValidator";

/**
 * Login
 * 
 * Unified login portal for KTech Field CRM.
 * Handles both Staff and Admin authentication.
 */
export default function Login() {
    const { login, verifyAdminOtp, isLoading, error: serverError } = login_service_provider();
    
    // Auth States
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [otp, setOtp] = useState("");
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [awaitingOtp, setAwaitingOtp] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError(null);

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
            setValidationError("Admin account verified. Enter your Security Code below.");
        }
    };

    const displayError = serverError || (!awaitingOtp ? validationError : null);
    const displayInfo = awaitingOtp ? validationError : null;

    return (
        <div className="login-container min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-50 via-white to-blue-50">
            <div className="login-box bg-white p-8 md:p-10 rounded-2xl shadow-2xl max-w-md w-full text-slate-900 border border-indigo-100 relative overflow-hidden backdrop-blur-sm">
                
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-500"></div>

                <div className="login-header mb-8 flex flex-col items-center">
                    <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4 shadow-inner text-emerald-600">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                        </svg>
                    </div>
                    <h1 className="text-3xl font-extrabold text-center tracking-tight text-slate-800 uppercase">
                        Staff <span className="text-emerald-600">Portal</span>
                    </h1>
                    <p className="text-center text-sm text-slate-500 mt-2 font-medium font-mono">
                        FIELD OPERATIONS LOGIN
                    </p>
                </div>

                <div className="login-body relative z-10">
                    {displayError && (
                        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded text-[10px] uppercase font-bold flex items-center gap-3">
                            <span className="flex-1">{displayError}</span>
                        </div>
                    )}

                    {displayInfo && (
                        <div className="mb-6 p-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 rounded text-[10px] uppercase font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <span className="flex-1">{displayInfo}</span>
                        </div>
                    )}

                    <form className="space-y-4" onSubmit={handleLogin}>
                        <div className="form-group flex flex-col group">
                            <label className="text-[10px] font-bold mb-1.5 text-slate-400 uppercase tracking-widest group-focus-within:text-emerald-600 transition-colors">Staff Email</label>
                            <input
                                type="email"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                                placeholder="name@ktech.com"
                                required
                                disabled={isLoading || awaitingOtp}
                            />
                        </div>
                        <div className="form-group flex flex-col group">
                            <label className="text-[10px] font-bold mb-1.5 text-slate-400 uppercase tracking-widest group-focus-within:text-emerald-600 transition-colors">Access Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                                placeholder="••••••••"
                                required
                                disabled={isLoading || awaitingOtp}
                            />
                        </div>

                        {isAdminMode && (
                            <div className="form-group flex flex-col group mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <label className="text-[10px] font-bold mb-1.5 text-emerald-600 uppercase tracking-widest italic">Security Code (Required for Admin)</label>
                                <input
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    className="w-full bg-emerald-50 border border-emerald-200 text-slate-900 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm font-medium tracking-widest"
                                    placeholder="Enter 6-digit code"
                                    required={isAdminMode}
                                    disabled={isLoading}
                                    autoFocus
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full mt-2 text-white py-3.5 rounded-xl font-bold shadow-xl transition-all transform active:scale-95 ${isLoading ? "bg-slate-400 cursor-not-allowed" : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/20"}`}
                        >
                            {isLoading ? "Authenticating..." : awaitingOtp ? "Verify Security Code" : isAdminMode ? "Sign In as Admin" : "Sign In & Access Workspace"}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col gap-4 text-center">
                        {!isAdminMode && (
                            <button 
                                type="button" 
                                onClick={() => setIsAdminMode(true)}
                                className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hover:text-emerald-600 transition-colors"
                            >
                                Enter as Administrator
                            </button>
                        )}
                        <div className="flex items-center justify-between px-2">
                            <a href="/register" className="text-[10px] text-emerald-600 font-bold hover:underline underline-offset-4 decoration-emerald-200 uppercase tracking-widest">Register Account</a>
                            <a href="/reset-password" className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hover:text-slate-600 transition-colors">Forgot Password?</a>
                        </div>
                    </div>
                </div> {/* End login-body */}
            </div> {/* End login-box */}
        </div> /* End login-container */
    );
}
