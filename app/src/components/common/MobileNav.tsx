"use client";

import React, { useState } from 'react';
import { useAuth } from '../../lib/AuthContext';

export default function MobileNav() {
    const { logout, user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="lg:hidden">
            {/* Hamburger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg transition-colors"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                aria-label="Toggle menu"
            >
                <svg className="w-6 h-6" style={{ color: 'var(--text-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {isOpen ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                </svg>
            </button>

            {/* Mobile Menu Overlay */}
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        style={{ background: 'rgba(0, 0, 0, 0.5)' }}
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="fixed top-0 right-0 h-full w-72 z-50 p-6 transform transition-transform duration-300 ease-in-out" style={{ background: 'var(--bg-surface)' }}>
                        <div className="flex flex-col h-full">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <p className="text-xs font-semibold">{user?.email}</p>
                                    <p className="text-[11px] uppercase tracking-widest font-semibold leading-none mt-1 px-2 py-0.5 rounded-full" style={{ color: 'var(--success)', background: 'var(--success-soft)' }}>Field Engineer</p>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 rounded-lg transition-colors"
                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                                >
                                    <svg className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Menu Items */}
                            <nav className="flex-1 space-y-2">
                                <a
                                    href="/employee/dashboard"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-3 p-4 rounded-lg transition-colors group"
                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                                >
                                    <svg className="w-5 h-5 transition-colors" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                    </svg>
                                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Dashboard</span>
                                </a>
                            </nav>

                            {/* Footer */}
                            <div className="pt-6" style={{ borderTop: '1px solid var(--border)' }}>
                                <button
                                    onClick={() => {
                                        logout();
                                        setIsOpen(false);
                                    }}
                                    className="w-full py-4 rounded-lg text-[11px] font-semibold uppercase tracking-widest transition-all"
                                    style={{ background: 'var(--accent)', color: 'white', borderRadius: '6px' }}
                                >
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
