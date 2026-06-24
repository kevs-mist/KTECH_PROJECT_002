"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { register_service_provider } from "./Register_sevice_provider";
import { AuthValidator } from "../../Auth/AuthValidator";

/**
 * Register
 * 
 * Registration portal for Prime Services CRM.
 * Default registration → Employee role (immediate access to employee dashboard).
 * Admin access requested → Pending user (stays in user table until admin approves).
 */
export default function Register() {
    const { register, isLoading, error: serverError } = register_service_provider();
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
        <div className="register-container min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-indigo-50 via-white to-blue-50">
            <div className="register-box bg-white p-8 md:p-10 rounded-2xl shadow-2xl max-w-md w-full text-slate-900 border border-indigo-100 relative overflow-hidden backdrop-blur-sm">
                
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-500"></div>

                <div className="register-header mb-8 flex flex-col items-center">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                        </svg>
                    </div>
                    <h1 className="text-3xl font-extrabold text-center tracking-tight text-slate-800">
                        Join <span className="text-emerald-600">Prime Services CRM</span>
                    </h1>
                    <p className="text-center text-sm text-slate-500 mt-2 font-medium">Register as a Field Engineer</p>
                </div>
                
                <div className="register-body relative z-10">
                    {displayError && (
                        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded shadow-sm text-xs flex items-center gap-3">
                            <span className="flex-1">{displayError}</span>
                        </div>
                    )}

                    <form className="space-y-4" onSubmit={handleRegister}>
                        <div className="form-group flex flex-col group">
                            <label htmlFor="name" className="text-[10px] font-bold mb-1.5 text-slate-400 uppercase tracking-widest group-focus-within:text-emerald-600 transition-colors">
                                Full Name
                            </label>
                            <input 
                                type="text" id="name" value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm" 
                                required placeholder="John Doe" disabled={isLoading}
                            />
                        </div>

                        <div className="form-group flex flex-col group">
                            <label htmlFor="email" className="text-[10px] font-bold mb-1.5 text-slate-400 uppercase tracking-widest group-focus-within:text-emerald-600 transition-colors">
                                Email Address
                            </label>
                            <input 
                                type="email" id="email" value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm" 
                                required placeholder="john@example.com" disabled={isLoading}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="form-group flex flex-col group">
                                <label htmlFor="password" className="text-[10px] font-bold mb-1.5 text-slate-400 uppercase tracking-widest group-focus-within:text-emerald-600 transition-colors">
                                    Password
                                </label>
                                <input 
                                    type="password" id="password" value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm" 
                                    required placeholder="••••••••" disabled={isLoading}
                                />
                            </div>

                            <div className="form-group flex flex-col group">
                                <label htmlFor="confirmPassword" className="text-[10px] font-bold mb-1.5 text-slate-400 uppercase tracking-widest group-focus-within:text-emerald-600 transition-colors">
                                    Confirm
                                </label>
                                <input 
                                    type="password" id="confirmPassword" value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm" 
                                    required placeholder="••••••••" disabled={isLoading}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 mt-2 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <input 
                                type="checkbox" id="adminRequest" 
                                checked={isAdminRequested} 
                                onChange={(e) => setIsAdminRequested(e.target.checked)}
                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" 
                                disabled={isLoading}
                            />
                            <div>
                                <label htmlFor="adminRequest" className="text-xs text-slate-700 font-bold block">
                                    Request Admin Access
                                </label>
                                <p className="text-[10px] text-slate-400 mt-0.5">Your account will be pending until an admin approves you.</p>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className={`w-full mt-4 text-white py-3.5 rounded-xl font-bold shadow-xl transition-all transform active:scale-95 ${
                                isLoading 
                                ? "bg-slate-400 cursor-not-allowed" 
                                : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/20"
                            }`}
                        >
                            {isLoading ? "Provisioning..." : "Create Account"}
                        </button>
                        
                        <div className="existing_account mt-8 text-center text-xs text-slate-500 font-medium">
                            Already have an account? <a href="/login" className="text-emerald-600 font-bold hover:underline underline-offset-4 decoration-emerald-200">Log in</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
