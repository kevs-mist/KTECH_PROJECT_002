"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/AuthContext";
import { useRouter } from "next/navigation";

export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-white/10 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href={user ? (user.email?.includes("admin") ? "/admin/dashboard" : "/dashboard") : "/login"} className="flex items-center gap-3 group">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-all duration-300">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight italic">
                Prime <span className="text-emerald-400">Services</span>
              </h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Field CRM</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          {user && (
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href={user.email?.includes("admin") ? "/admin/dashboard" : "/dashboard"}
                className="text-sm font-medium text-slate-300 transition-colors duration-200"
              >
                Dashboard
              </Link>
              <div className="flex items-center gap-4 pl-6 border-l border-white/10">
                <div className="text-right">
                  <p className="text-xs font-bold text-white">{user.email}</p>
                  <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold">
                    {user.email?.includes("admin") ? "Administrator" : "Staff"}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-white/10 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 border border-white/10"
                >
                  Sign Out
                </button>
              </div>
            </nav>
          )}

          {/* Mobile menu button */}
          {user && (
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-300 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          )}
        </div>

        {/* Mobile menu */}
        {isMenuOpen && user && (
          <div className="md:hidden py-4 border-t border-white/10 animate-in slide-in-from-top-2 duration-300">
            <nav className="flex flex-col gap-4">
              <Link
                href={user.email?.includes("admin") ? "/admin/dashboard" : "/dashboard"}
                className="text-sm font-medium text-slate-300 transition-colors py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Dashboard
              </Link>
              <div className="pt-4 border-t border-white/10">
                <p className="text-xs font-bold text-white mb-2">{user.email}</p>
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMenuOpen(false);
                  }}
                  className="w-full bg-white/10 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 border border-white/10"
                >
                  Sign Out
                </button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
