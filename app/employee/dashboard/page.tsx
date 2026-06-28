"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../src/lib/AuthContext";
import { ticketService, Ticket } from "../../src/lib/services/ticketService";
import { uploadMediaToStorage } from "../../src/lib/storageService";
import { supabase } from "../../src/lib/supabase";
import { debounce } from "../../src/lib/utils/debounce";
import { ErrorHandler } from "../../src/lib/utils/errorHandler";
import { sanitizeFileName } from "../../src/lib/utils/fileName";
import TicketCheckInButton from "../components/TicketCheckInButton";
import MobileNav from "../../src/components/common/MobileNav";
import Notifications from "../../src/components/common/Notifications";

export default function EmployeeDashboard() {
    const { user, role, logout } = useAuth();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [visibleTicketCount, setVisibleTicketCount] = useState(20);
    const [isPulling, setIsPulling] = useState(false);
    const [pullProgress, setPullProgress] = useState(0);
    const [touchStartY, setTouchStartY] = useState(0);

    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isActionPending, setIsActionPending] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [actionNotes, setActionNotes] = useState("");
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [actionError, setActionError] = useState<string | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [notificationPermission, setNotificationPermission] = useState(Notification.permission);

    // Reusable debounced fetch that updates state without resetting screen loading state
    const debouncedFetch = React.useMemo(
        () => debounce(async () => {
            if (!user) return;
            try {
                const data = await ticketService.getEmployeeTickets();
                setTickets(data);
            } catch (error) {
                console.error("Failed to fetch tickets in background:", error);
            }
        }, 500),
        [user]
    );

    const fetchTickets = useCallback(async () => {
        try {
            if (!user) return;
            setIsLoading(true);
            setFetchError(null);
            const data = await ticketService.getEmployeeTickets();
            setTickets(data);
        } catch (error) {
            console.error("Failed to fetch tickets:", error);
            setFetchError("Failed to load tickets. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const requestNotificationPermission = async () => {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    };

    useEffect(() => {
        if (user && role === "employee") {
            fetchTickets();
        }
    }, [user, role, fetchTickets]);

    // Supabase Realtime Listener
    useEffect(() => {
        if (!user || role !== "employee") return;

        const channel = supabase
            .channel(`employee-dashboard-${user.uid}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tickets' },
                () => {
                    debouncedFetch();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'employees' },
                () => {
                    // When employee record changes (status, online status, etc), refresh tickets
                    debouncedFetch();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, role, debouncedFetch]);

    // Network Reconnect Recovery
    useEffect(() => {
        const handleOnline = () => {
            debouncedFetch();
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [debouncedFetch]);

    // Immediately fetch tickets when role becomes 'employee'
    useEffect(() => {
        if (user && role === "employee") {
            fetchTickets();
        }
    }, [role, fetchTickets, user]);

    // 5-Second Auto-Refresh Polling Fallback
    useEffect(() => {
        if (!user || role !== "employee") return;
        const interval = setInterval(() => {
            debouncedFetch();
        }, 5000);
        return () => clearInterval(interval);
    }, [user, role, debouncedFetch]);

    const handleStartWork = async (ticket: Ticket) => {
        if (isActionPending) return;
        setIsActionPending(true);
        try {
            await ticketService.markInProgress(ticket.id!, ticket.version || 1);
            await fetchTickets();
        } catch (err: unknown) {
            console.error("Error marking in progress:", err);
            alert(ErrorHandler.format(err, "Failed to start work."));
        } finally {
            setIsActionPending(false);
        }
    };

    const handleAccept = async (ticket: Ticket) => {
        if (!user || isActionPending) return;
        setIsActionPending(true);
        try {
            await ticketService.acceptTicket(ticket.id!, user.uid, ticket.version || 1);
            await fetchTickets();
        } catch (err: unknown) {
            console.error("Error accepting ticket:", err);
            alert(ErrorHandler.format(err, "Failed to accept ticket."));
        } finally {
            setIsActionPending(false);
        }
    };

    const resetModalState = () => {
        setSelectedFile(null);
        setActionNotes("");
        setUploadProgress(0);
        setActionError(null);
    };

    const handleResolve = async () => {
        if (!selectedTicket || !selectedTicket.id || isActionLoading) return;
        if (!selectedFile) {
            setActionError("A photo or video of the working machine is REQUIRED to mark this ticket as resolved.");
            return;
        }

        setIsActionLoading(true);
        setActionError(null);
        try {
            const fileName = `tickets/${selectedTicket.id}/${Date.now()}_${sanitizeFileName(selectedFile.name)}`;
            const downloadUrl = await uploadMediaToStorage(selectedFile, fileName, (p) => setUploadProgress(p));

            await ticketService.resolveTicket(selectedTicket.id, selectedTicket.version || 1, downloadUrl, actionNotes);

            await fetchTickets();
            setSelectedTicket(null);
            resetModalState();
        } catch (err: unknown) {
            console.error("Error resolving ticket:", err);
            setActionError(ErrorHandler.format(err, "Failed to resolve ticket."));
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleEscalate = async () => {
        if (!selectedTicket || !selectedTicket.id || isActionLoading) return;

        if (!actionNotes.trim()) {
            setActionError("Please provide a reason for escalation in the Notes section.");
            return;
        }

        if (!confirm("Are you sure you want to escalate this ticket? This will send it back to the admin for review.")) {
            return;
        }

        setIsActionLoading(true);
        setActionError(null);
        try {
            let downloadUrl = "";
            if (selectedFile) {
                const fileName = `tickets/${selectedTicket.id}/${Date.now()}_escalation_${sanitizeFileName(selectedFile.name)}`;
                downloadUrl = await uploadMediaToStorage(selectedFile, fileName, (p) => setUploadProgress(p));
            }

            await ticketService.escalateTicket(selectedTicket.id, selectedTicket.version || 1, downloadUrl, actionNotes);

            await fetchTickets();
            setSelectedTicket(null);
            resetModalState();
        } catch (err: unknown) {
            console.error("Error escalating ticket:", err);
            setActionError(ErrorHandler.format(err, "Failed to escalate ticket."));
        } finally {
            setIsActionLoading(false);
        }
    };

    const myTickets = tickets.filter(t => t.assigned_to === user?.uid && t.status !== 'closed');
    const resolvedTickets = tickets.filter(t => t.assigned_to === user?.uid && t.status === 'closed');
    const availableTickets = tickets.filter(t => !t.assigned_to && t.status === "open");

    // Pull-to-refresh handlers
    const handleTouchStart = (e: React.TouchEvent) => {
        if (window.scrollY === 0) {
            setTouchStartY(e.touches[0].clientY);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (window.scrollY === 0 && touchStartY > 0) {
            const currentY = e.touches[0].clientY;
            const diff = currentY - touchStartY;
            if (diff > 0) {
                setIsPulling(true);
                setPullProgress(Math.min(diff / 100, 1));
            }
        }
    };

    const handleTouchEnd = async () => {
        if (isPulling && pullProgress > 0.5) {
            setIsPulling(true);
            await fetchTickets();
        }
        setIsPulling(false);
        setPullProgress(0);
        setTouchStartY(0);
    };


    return (
        <div 
            className="min-h-screen p-4 md:p-8 font-sans page-enter safe-top" 
            style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Pull-to-refresh indicator */}
            {isPulling && (
                <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pt-4" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', transform: `translateY(${pullProgress * 50}px)` }}>
                    <div className="flex items-center gap-2">
                        <svg className={`w-5 h-5 ${pullProgress > 0.5 ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--accent)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
                            {pullProgress > 0.5 ? 'Refreshing...' : 'Pull to refresh'}
                        </span>
                    </div>
                </div>
            )}
            {/* Top Navigation */}
            <nav className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between mb-6 md:mb-10 p-4 md:p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <div className="flex items-center gap-3 md:gap-4">
                    <img 
                        src="/images/prime_services_logo.png?v=1" 
                        alt="Prime Services ATM Services & Maintenance" 
                        loading="lazy"
                        className="w-8 h-8 sm:w-10 sm:h-12 md:w-12 md:h-12 object-contain"
                    />
                    <div>
                        <h1 className="text-base md:text-lg font-semibold" style={{ letterSpacing: '-0.02em' }}>Prime Services CRM</h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }}></span>
                            <p className="text-[10px] md:text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Live Operations Console</p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                    <div className="text-right sm:text-left">
                        <p className="text-xs font-semibold truncate max-w-[200px]">{user?.email}</p>
                        <p className="text-[10px] md:text-[11px] font-semibold uppercase tracking-widest leading-none mt-1 px-2 py-0.5 rounded-full inline-block" style={{ color: 'var(--success)', background: 'var(--success-soft)' }}>Field Engineer</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Notifications />
                        <button
                            onClick={() => logout()}
                            className="px-4 py-3 min-h-[44px] text-[10px] md:text-[11px] font-semibold uppercase tracking-widest transition-all"
                            style={{ background: 'var(--accent)', color: 'white', borderRadius: '6px' }}
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </nav>

            {/* Error banner */}
            {fetchError && (
                <div className="p-4 text-sm rounded-lg flex items-center gap-3" style={{ background: 'var(--error-soft)', border: '1px solid var(--error)', color: 'var(--error)' }}>
                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                    <span><strong>Load failed:</strong> {fetchError}</span>
                    <button onClick={fetchTickets} className="ml-auto text-xs underline" style={{ color: 'var(--error)' }}>Retry</button>
                </div>
            )}

            <main className="max-w-7xl mx-auto space-y-6 md:space-y-8 sm:space-y-10">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 md:p-6">
                        <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>My Tasks</p>
                        <p className="text-2xl sm:text-3xl font-black italic" style={{ color: 'var(--text-primary)' }}>{myTickets.length}</p>
                    </div>
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 md:p-6">
                        <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>Available</p>
                        <p className="text-2xl sm:text-3xl font-black italic" style={{ color: 'var(--success)' }}>{availableTickets.length}</p>
                    </div>
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 md:p-6">
                        <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>Resolved</p>
                        <p className="text-2xl sm:text-3xl font-black italic" style={{ color: 'var(--text-primary)' }}>
                            {tickets.filter(t => t.assigned_to === user?.uid && t.status === 'closed').length}
                        </p>
                    </div>
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 md:p-6">
                        <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>In Progress</p>
                        <p className="text-2xl sm:text-3xl font-black italic" style={{ color: 'var(--text-primary)' }}>
                            {myTickets.filter(t => t.status === 'in_progress').length}
                        </p>
                    </div>
                </div>
                {notificationPermission !== "granted" && (
                  <div className="flex items-center justify-between bg-[var(--accent-soft)] border border-[var(--accent)]/20 rounded-xl px-4 py-3 mb-4">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        Enable notifications
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Get alerted on new ticket assignments
                      </p>
                    </div>
                    <button
                      onClick={requestNotificationPermission}
                      className="text-xs font-semibold text-[var(--accent)] bg-[var(--accent)]/10 px-3 py-1.5 rounded-lg whitespace-nowrap"
                    >
                      Enable
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Active */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">Active Assignments</h2>
                        </div>

                        <div className="space-y-4">
                            {isLoading ? (
                                // Skeleton loaders for active tickets
                                Array.from({ length: 2 }).map((_, i) => (
                                    <div key={i} className="p-4 sm:p-6 md:p-8 rounded-lg relative overflow-hidden animate-pulse" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                        <div className="absolute top-0 left-0 w-full h-1 bg-slate-200"></div>
                                        <div className="flex justify-between items-start mb-4 sm:mb-6 pt-2">
                                            <div className="space-y-2">
                                                <div className="h-4 w-24 bg-slate-200 rounded"></div>
                                                <div className="h-6 w-48 sm:w-64 bg-slate-200 rounded"></div>
                                            </div>
                                            <div className="h-5 w-16 bg-slate-200 rounded-full"></div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
                                            <div className="flex items-center gap-3 sm:gap-4 bg-slate-50 p-3 sm:p-4 rounded-2xl">
                                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-200 rounded-xl shrink-0"></div>
                                                <div className="flex-1 space-y-1">
                                                    <div className="h-3 w-20 bg-slate-200 rounded"></div>
                                                    <div className="h-4 w-32 bg-slate-200 rounded"></div>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 sm:gap-4">
                                                <div className="flex-1 bg-slate-50 p-3 sm:p-4 rounded-2xl space-y-1">
                                                    <div className="h-3 w-12 bg-slate-200 rounded"></div>
                                                    <div className="h-4 w-20 bg-slate-200 rounded"></div>
                                                </div>
                                                <div className="flex-1 bg-slate-50 p-3 sm:p-4 rounded-2xl space-y-1">
                                                    <div className="h-3 w-12 bg-slate-200 rounded"></div>
                                                    <div className="h-4 w-20 bg-slate-200 rounded"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="h-10 w-full bg-slate-200 rounded-lg"></div>
                                    </div>
                                ))
                            ) : myTickets.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                                  <div className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center mb-3">
                                    {/* Ticket/clipboard icon */}
                                    <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  <p className="text-sm font-medium text-[var(--text-secondary)]">
                                    No active assignments
                                  </p>
                                  <p className="text-xs text-[var(--text-muted)] mt-1">
                                    New tickets will appear here when assigned
                                  </p>
                                </div>
                            ) : (
                                myTickets.map(ticket => {
                                    const getBadgeStyle = (status: string) => {
                                        const styles: Record<string, { bg: string; color: string; border: string }> = {
                                            in_progress: { bg: 'var(--warning-soft)', color: '#fbbf24', border: '#d9770630' },
                                            re_raised: { bg: 'var(--error-soft)', color: '#f87171', border: '#dc262630' },
                                            assigned: { bg: 'var(--accent-soft)', color: '#60a5fa', border: '#2563eb30' },
                                        };
                                        return styles[status] || { bg: 'var(--accent-soft)', color: '#60a5fa', border: '#2563eb30' };
                                    };
                                    const badgeStyle = getBadgeStyle(ticket.status || 'assigned');
                                    return (
                                    <div key={ticket.id} className="p-4 sm:p-6 md:p-8 rounded-lg transition-all group relative overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                        {/* Status Indicator Bar */}
                                        <div className="absolute top-0 left-0 w-full h-1 transition-colors duration-300" style={{ background: 'var(--accent)' }}></div>

                                        <div className="flex justify-between items-start mb-4 sm:mb-6 pt-2">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[9px] sm:text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>{ticket.ticket_no}</p>
                                                    <span className="text-[7px] sm:text-[8px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                                                        {ticket.issue_type}
                                                    </span>
                                                </div>
                                                <h4 className="text-lg sm:text-xl md:text-2xl font-semibold leading-tight">{ticket.title}</h4>
                                            </div>
                                            <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full" style={{ background: badgeStyle.bg, color: badgeStyle.color, border: `1px solid ${badgeStyle.border}` }}>
                                                {ticket.status === 'in_progress' ? 'Working' : ticket.status === 're_raised' ? 'Escalated' : 'Assigned'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
                                            <div className="flex items-center gap-3 sm:gap-4 bg-gradient-to-br from-slate-50 to-slate-100/50 p-3 sm:p-4 rounded-2xl border border-slate-100  transition-colors min-w-0">
                                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-slate-400 transition-all shrink-0">
                                                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Atm Location</p>
                                                    {ticket.atm_location?.startsWith('http') ? (
                                                        <a 
                                                            href={ticket.atm_location} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="text-xs sm:text-sm font-bold text-emerald-600 flex items-center gap-1 transition-colors truncate"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            View Map ↗
                                                        </a>
                                                    ) : (
                                                        <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">{ticket.atm_location}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-3 sm:gap-4 min-w-0">
                                                <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100/50 p-3 sm:p-4 rounded-2xl border border-slate-100  transition-colors min-w-0">
                                                    <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Bank</p>
                                                    <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">{ticket.bank_id}</p>
                                                </div>
                                                <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100/50 p-3 sm:p-4 rounded-2xl border border-slate-100  transition-colors min-w-0">
                                                    <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Terminal</p>
                                                    <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">{ticket.atm_id}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                            {ticket.status === 'assigned' && (
                                                <div className="flex-1">
                                                    <TicketCheckInButton 
                                                        ticket={ticket} 
                                                        onCheckInSuccess={() => fetchTickets()} 
                                                    />
                                                </div>
                                            )}
                                            <button
                                                onClick={() => setSelectedTicket(ticket)}
                                                className="flex-1 py-3 sm:py-4 rounded-lg text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest transition-all"
                                                style={{ background: 'var(--accent)', color: 'white', borderRadius: '6px' }}
                                            >
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                    );
                                })
                            )}
                        </div>
                    </section>

                    {/* Open Pool */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">Open Deployment Pool</h2>
                        </div>

                        <div className="space-y-4">
                            {isLoading ? (
                                // Skeleton loaders for available tickets
                                Array.from({ length: 2 }).map((_, i) => (
                                    <div key={i} className="p-4 sm:p-6 md:p-8 rounded-lg relative overflow-hidden animate-pulse" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                        <div className="absolute top-0 left-0 w-full h-1 bg-slate-200"></div>
                                        <div className="flex justify-between items-start mb-4 sm:mb-6 pt-2">
                                            <div className="space-y-2">
                                                <div className="h-4 w-24 bg-slate-200 rounded"></div>
                                                <div className="h-6 w-48 sm:w-64 bg-slate-200 rounded"></div>
                                            </div>
                                            <div className="h-5 w-16 bg-slate-200 rounded-full"></div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
                                            <div className="flex items-center gap-3 sm:gap-4 bg-slate-50 p-3 sm:p-4 rounded-2xl">
                                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-200 rounded-xl shrink-0"></div>
                                                <div className="flex-1 space-y-1">
                                                    <div className="h-3 w-20 bg-slate-200 rounded"></div>
                                                    <div className="h-4 w-32 bg-slate-200 rounded"></div>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 sm:gap-4">
                                                <div className="flex-1 bg-slate-50 p-3 sm:p-4 rounded-2xl space-y-1">
                                                    <div className="h-3 w-12 bg-slate-200 rounded"></div>
                                                    <div className="h-4 w-20 bg-slate-200 rounded"></div>
                                                </div>
                                                <div className="flex-1 bg-slate-50 p-3 sm:p-4 rounded-2xl space-y-1">
                                                    <div className="h-3 w-12 bg-slate-200 rounded"></div>
                                                    <div className="h-4 w-20 bg-slate-200 rounded"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="h-10 w-full bg-slate-200 rounded-lg"></div>
                                    </div>
                                ))
                            ) : availableTickets.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                                  <div className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center mb-3">
                                    {/* Checkmark circle icon */}
                                    <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                  <p className="text-sm font-medium text-[var(--text-secondary)]">
                                    All sites operational
                                  </p>
                                  <p className="text-xs text-[var(--text-muted)] mt-1">
                                    No pending deployments at the moment
                                  </p>
                                </div>
                            ) : (
                                availableTickets.map(ticket => (
                                    <div key={ticket.id} className="p-4 sm:p-6 md:p-8 rounded-lg transition-all group relative overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                        {/* Status Indicator Bar */}
                                        <div className="absolute top-0 left-0 w-full h-1 transition-colors duration-300" style={{ background: 'var(--warning)' }}></div>

                                        <div className="flex justify-between items-start mb-4 sm:mb-6 pt-2">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[9px] sm:text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>{ticket.ticket_no}</p>
                                                    <span className="text-[7px] sm:text-[8px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                                                        {ticket.issue_type}
                                                    </span>
                                                </div>
                                                <h4 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 leading-tight transition-colors">{ticket.title}</h4>
                                            </div>
                                            <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full" style={{ background: 'var(--warning-soft)', color: 'var(--warning)', border: `1px solid var(--warning-border)` }}>
                                                Available
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
                                            <div className="flex items-center gap-3 sm:gap-4 bg-gradient-to-br from-slate-50 to-slate-100/50 p-3 sm:p-4 rounded-2xl border border-slate-100  transition-colors min-w-0">
                                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-slate-400 transition-all shrink-0">
                                                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Atm Location</p>
                                                    {ticket.atm_location?.startsWith('http') ? (
                                                        <a 
                                                            href={ticket.atm_location} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="text-xs sm:text-sm font-bold text-emerald-600 flex items-center gap-1 transition-colors truncate"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            View Map ↗
                                                        </a>
                                                    ) : (
                                                        <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">{ticket.atm_location}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-3 sm:gap-4 min-w-0">
                                                <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100/50 p-3 sm:p-4 rounded-2xl border border-slate-100  transition-colors min-w-0">
                                                    <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Bank</p>
                                                    <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">{ticket.bank_id}</p>
                                                </div>
                                                <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100/50 p-3 sm:p-4 rounded-2xl border border-slate-100  transition-colors min-w-0">
                                                    <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Terminal</p>
                                                    <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">{ticket.atm_id}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                            <button
                                                onClick={() => handleAccept(ticket)}
                                                className="flex-1 py-3 sm:py-4 rounded-lg text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest transition-all"
                                                style={{ background: 'var(--success-soft)', color: 'var(--success)', border: '1px solid var(--success-border)' }}
                                            >
                                                ✓ Claim
                                            </button>
                                            <button 
                                                onClick={() => setSelectedTicket(ticket)}
                                                className="flex-1 py-3 sm:py-4 rounded-lg text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest transition-all"
                                                style={{ background: 'var(--accent)', color: 'white', borderRadius: '6px' }}
                                            >
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </div>

                {/* Resolved History Table */}
                <section className="space-y-6 pt-10">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h2 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">Resolved History</h2>
                            <p className="text-[10px] uppercase font-semibold tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Audit trail of completed deployments</p>
                        </div>
                    </div>

                    <div className="rounded-[2rem] overflow-hidden shadow-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-4 p-4">
                            {resolvedTickets.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-[10px] font-semibold uppercase tracking-widest italic" style={{ color: 'var(--text-tertiary)' }}>No deployments completed yet</p>
                                </div>
                            ) : (
                                resolvedTickets.slice(0, visibleTicketCount).map(ticket => (
                                    <div key={ticket.id} className="p-4 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="text-xs font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>{ticket.ticket_no}</p>
                                                <p className="text-[8px] font-semibold uppercase tracking-wider mt-1" style={{ color: 'var(--text-tertiary)' }}>{ticket.issue_type}</p>
                                            </div>
                                            <span className="text-[8px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full" style={{ background: 'var(--success)', color: 'white' }}>Resolved</span>
                                        </div>
                                        <p className="text-xs font mb-3" style={{ color: 'var(--text-primary)' }}>{ticket.title}</p>
                                        <div className="flex items-center gap-2 text-[10px] font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                                            <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                                            <span className="truncate">{ticket.atm_location}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <p className="text-[10px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>{new Date(ticket.updated_at || ticket.created_at || '').toLocaleDateString()}</p>
                                            <button
                                                onClick={() => setSelectedTicket(ticket)}
                                                className="p-2 rounded-lg"
                                                style={{ color: 'var(--text-tertiary)' }}
                                                title="View Evidence"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542 7z" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto pb-2">
                            <table className="w-full min-w-[720px] text-left border-collapse">
                                <thead>
                                    <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Ticket #</th>
                                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Issue</th>
                                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Location</th>
                                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Status</th>
                                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Completed</th>
                                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                    {resolvedTickets.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-12 sm:py-16 text-center">
                                                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest italic" style={{ color: 'var(--text-tertiary)' }}>No deployments completed yet</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        resolvedTickets.slice(0, visibleTicketCount).map(ticket => (
                                            <tr key={ticket.id} className="group transition-colors" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                                <td className="px-3 sm:px-4 py-2 sm:py-3">
                                                    <span className="text-[10px] sm:text-xs font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>{ticket.ticket_no}</span>
                                                </td>
                                                <td className="px-3 sm:px-4 py-2 sm:py-3">
                                                    <div className="space-y-1">
                                                        <p className="text-xs sm:text-sm font" style={{ color: 'var(--text-primary)' }}>{ticket.title}</p>
                                                        <span className="text-[8px] sm:text-[9px] font-semibold px-1.5 sm:px-2 py-0.5 rounded uppercase" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>{ticket.issue_type}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 sm:px-4 py-2 sm:py-3 max-w-[150px] sm:max-w-[200px]">
                                                    <div className="flex items-center gap-2 text-[10px] sm:text-xs font-semibold min-w-0" style={{ color: 'var(--text-secondary)' }}>
                                                        <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                                                        {ticket.atm_location?.startsWith('http') ? (
                                                            <a 
                                                                href={ticket.atm_location} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                className="truncate"
                                                                style={{ color: 'var(--success)' }}
                                                            >
                                                                View Map ↗
                                                            </a>
                                                        ) : (
                                                            <span className="truncate">{ticket.atm_location}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 sm:px-4 py-2 sm:py-3">
                                                    <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-widest px-2 sm:px-3 py-1 sm:py-1.5 rounded-full" style={{ background: 'var(--success)', color: 'white' }}>Resolved</span>
                                                </td>
                                                <td className="px-3 sm:px-4 py-2 sm:py-3">
                                                    <p className="text-[10px] sm:text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{new Date(ticket.updated_at || ticket.created_at || '').toLocaleDateString()}</p>
                                                </td>
                                                <td className="px-3 sm:px-4 py-2 sm:py-3">
                                                    <button
                                                        onClick={() => setSelectedTicket(ticket)}
                                                        className="p-2 rounded-lg transition-colors"
                                                        style={{ color: 'var(--text-tertiary)' }}
                                                        title="View Evidence"
                                                    >
                                                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542 7z" /></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {resolvedTickets.length > visibleTicketCount && (
                            <button
                                onClick={() => setVisibleTicketCount(prev => prev + 20)}
                                className="w-full py-3 text-xs font-semibold uppercase tracking-widest transition-colors"
                                style={{ color: 'var(--accent)' }}
                            >
                                Load More ({resolvedTickets.length - visibleTicketCount} remaining)
                            </button>
                        )}
                    </div>
                </section>
            </main>

            {/* Ticket Detail Modal */}
            {selectedTicket && (
                <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-4xl h-[calc(100vh-80px)] md:h-auto md:max-h-[90vh] md:rounded-[2rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-200 flex flex-col md:flex-row">
                        {/* Drag Handle for Mobile */}
                        <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
                            <div className="w-8 h-1 rounded-full bg-slate-300"></div>
                        </div>
                        {/* Map/Image Side */}
                        <div className="md:w-5/12 bg-emerald-900 relative p-6 md:p-8 flex flex-col justify-between text-white hidden md:flex">
                            <div className="absolute inset-0 opacity-20 bg-[url('https://www.google.com/maps/vt/pb=!1m4!1m3!1i12!2i2345!3i1234!2m3!1e0!2sm!3i420120488!3m8!2sen!3sus!5e1105!12m4!1e68!2m2!1sset!2sRoadmap!4e0!5m1!1f2!6m8!1e1!2m2!1sIAq6iy_B_8EAAAQ0OEZpBQ!2e7!3e15!6m1!1i1!23i1308886')] bg-cover grayscale transition-all duration-700"></div>
                            <div className="relative z-10">
                                <span className="text-[9px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{selectedTicket.status}</span>
                                <h2 className="text-3xl font-black italic uppercase leading-none mt-4 tracking-tighter">{selectedTicket.ticket_no}</h2>
                                <p className="text-emerald-300 text-xs font-bold mt-2 font-mono">{selectedTicket.atm_id}</p>
                            </div>
                            <div className="relative z-10 space-y-4">
                                <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10">
                                    <p className="text-[9px] font-black text-emerald-300 uppercase tracking-widest mb-1">Navigation Target</p>
                                    <p className="text-sm font-bold leading-snug truncate">{selectedTicket.atm_location}</p>
                                    <a
                                        href={selectedTicket.atm_location?.startsWith('http') ? selectedTicket.atm_location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedTicket.atm_location)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-block mt-3 text-[10px] font-black uppercase bg-white text-emerald-900 px-4 py-2 rounded-xl hover:bg-emerald-50 transition-colors"
                                    >
                                        Open in G-Maps
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Content Side */}
                        <div className="md:w-7/12 relative flex flex-col h-full bg-white">
                            {/* Mobile Header */}
                            <div className="md:hidden flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{selectedTicket.status}</span>
                                    <p className="text-xs font-semibold font-mono" style={{ color: 'var(--text-secondary)' }}>{selectedTicket.ticket_no}</p>
                                </div>
                                <button onClick={() => setSelectedTicket(null)} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-all" style={{ background: 'var(--bg-elevated)' }}>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            {/* Desktop Close Button */}
                            <button onClick={() => setSelectedTicket(null)} className="hidden md:flex absolute top-4 right-4 p-2 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all z-20 shadow-sm">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>

                            <div className="flex-1 overflow-y-auto p-4 md:p-6 md:p-8 pb-24 md:pb-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                                <div className="flex items-center gap-3 mb-2 pr-8">
                                    <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>{selectedTicket.issue_type} Fault Detected</span>
                                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent)' }}></span>
                                </div>
                                <h3 className="text-3xl font-black text-slate-900 leading-tight mb-6 pr-8">{selectedTicket.title}</h3>

                                <div className="p-5 rounded-3xl border mb-6 relative overflow-hidden" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                                    <div className="absolute top-0 left-0 w-1 h-full" style={{ background: 'var(--border)' }}></div>
                                    <p className="text-[9px] font-semibold uppercase tracking-widest mb-2 ml-2" style={{ color: 'var(--text-secondary)' }}>Engineer Briefing</p>
                                    <p className="text-sm leading-relaxed font-medium whitespace-pre-wrap ml-2" style={{ color: 'var(--text-primary)' }}>{selectedTicket.description}</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                    <div className="p-5 rounded-2xl border" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                                        <p className="text-[9px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-secondary)' }}>Bank Network</p>
                                        <p className="text-sm font-semibold line-clamp-1" style={{ color: 'var(--text-primary)' }}>{selectedTicket.bank_id}</p>
                                    </div>
                                    <div className="p-5 rounded-2xl border" style={{ background: 'var(--error-soft)', border: '1px solid var(--error-border)' }}>
                                        <p className="text-[9px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--error)' }}>Priority</p>
                                        <p className="text-sm font-semibold tracking-wider" style={{ color: 'var(--error)' }}>
                                            {String(selectedTicket.priority || selectedTicket.issue_type || "Standard").toUpperCase()}
                                        </p>
                                    </div>
                                </div>

                                {selectedTicket.status !== 're_raised' && selectedTicket.status !== 'closed' && (
                                    <div className="mt-6 mb-6 animate-in fade-in duration-300">
                                        <label className="text-[10px] font-semibold uppercase tracking-widest mb-3 block" style={{ color: 'var(--text-secondary)' }}>Proof of Work (Photo / Video)</label>
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                            <label className="cursor-pointer group flex items-center justify-center gap-2 px-6 py-4 rounded-2xl transition-all w-full sm:w-auto min-w-[200px]" style={{ background: 'var(--bg-surface)', border: '2px dashed var(--border)' }}>
                                                <svg className="w-5 h-5 transition-colors" style={{ color: 'var(--text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                <span className="text-[11px] font-semibold uppercase tracking-wider transition-colors" style={{ color: 'var(--text-tertiary)' }}>Select Media</span>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*,video/*"
                                                    capture="environment"
                                                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                                    disabled={isActionLoading}
                                                />
                                            </label>
                                            {selectedFile ? (
                                                <div className="flex items-center gap-3 px-4 py-4 rounded-2xl border flex-1 min-w-0 w-full shadow-sm" style={{ background: 'var(--success-soft)', border: '1px solid var(--success-border)' }}>
                                                    <svg className="w-5 h-5 shrink-0" style={{ color: 'var(--success)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    <span className="text-xs font-semibold truncate" style={{ color: 'var(--success)' }}>
                                                        {selectedFile.name}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 px-4 py-4 flex-1 min-w-0 w-full">
                                                    <span className="text-xs font-medium italic" style={{ color: 'var(--text-tertiary)' }}>No media selected yet</span>
                                                </div>
                                            )}
                                        </div>

                                        {isActionLoading && uploadProgress > 0 && (
                                            <div className="mt-5 p-4 rounded-2xl border" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                                                <div className="flex justify-between items-center mb-2">
                                                    <p className="text-[9px] uppercase font-semibold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Uploading Media</p>
                                                    <p className="text-[10px] font-semibold" style={{ color: 'var(--success)' }}>{Math.round(uploadProgress)}%</p>
                                                </div>
                                                <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: 'var(--border)' }}>
                                                    <div className="h-2 rounded-full transition-all duration-300 relative" style={{ width: `${uploadProgress}%`, background: 'var(--success)' }}>
                                                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {(selectedTicket.status === 're_raised' || selectedTicket.status === 'closed') && selectedTicket.proof_media_url && (
                                    <div className="mt-6 mb-6 animate-in fade-in duration-300">
                                        <label className="text-[10px] font-semibold uppercase tracking-widest mb-3 block" style={{ color: 'var(--text-secondary)' }}>Submitted Proof of Work</label>
                                        <div className="rounded-2xl overflow-hidden border shadow-sm max-w-md" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                                            {selectedTicket.proof_media_url.match(/\.(mp4|mov|webm)$/i) || selectedTicket.proof_media_url.includes("video") ? (
                                                <video src={selectedTicket.proof_media_url} controls className="w-full max-h-60 object-contain bg-black" />
                                            ) : (
                                                <img src={selectedTicket.proof_media_url} alt="Proof of Work" loading="lazy" className="w-full max-h-60 object-cover" />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {selectedTicket.status !== 're_raised' && selectedTicket.status !== 'closed' && (
                                    <div className="mt-4 animate-in fade-in duration-300">
                                        <label className="text-[10px] font-semibold uppercase tracking-widest mb-2 flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
                                            {actionError?.includes("Reason") ? (
                                                <span className="flex items-center gap-1" style={{ color: 'var(--error)' }}>
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                    Reason for Escalation (REQUIRED)
                                                </span>
                                            ) : (
                                                "Resolution / Escalation Notes"
                                            )}
                                        </label>
                                        <textarea
                                            className={`w-full border rounded-2xl p-4 text-base min-h-[48px] outline-none transition-all resize-none shadow-inner ${actionError?.includes("Reason") ? 'ring-2 ring-red-500/20' : ''}`}
                                            style={{
                                                background: actionError?.includes("Reason") ? 'var(--error-soft)' : 'var(--bg-elevated)',
                                                borderColor: actionError?.includes("Reason") ? 'var(--error)' : 'var(--border)'
                                            }}
                                            rows={4}
                                            placeholder="Explain the issue or reason for escalation here for Admin review..."
                                            value={actionNotes}
                                            onChange={(e) => setActionNotes(e.target.value)}
                                            disabled={isActionLoading}
                                        />

                                        {actionError && !actionError.includes("Reason") && (
                                            <div className="mt-4 p-4 rounded-xl text-xs font-semibold flex items-start gap-3 shadow-sm" style={{ background: 'var(--error-soft)', border: '1px solid var(--error-border)', color: 'var(--error)' }}>
                                                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                <p>{actionError}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {(selectedTicket.status === 're_raised' || selectedTicket.status === 'closed') && selectedTicket.resolution_notes && (
                                    <div className="mt-6 mb-6 p-5 rounded-3xl border animate-in fade-in duration-300" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                                        <p className="text-[9px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>
                                            {selectedTicket.status === 're_raised' ? "Escalation Reason" : "Resolution Notes"}
                                        </p>
                                        <p className="text-sm leading-relaxed font-medium whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{selectedTicket.resolution_notes}</p>
                                    </div>
                                )}
                            </div>

                            <div className="fixed bottom-0 left-0 right-0 md:static px-4 pb-4 md:px-6 md:pb-6 md:pt-4 pt-4 border-t flex gap-4 shrink-0 z-50 safe-bottom w-full" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                {selectedTicket.status === 're_raised' ? (
                                    <div className="flex-1 p-4 rounded-2xl text-center" style={{ background: 'var(--error-soft)', border: '1px solid var(--error-border)' }}>
                                        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--error)' }}>⏳ Pending Admin Review</p>
                                        <p className="text-[10px] mt-1" style={{ color: 'var(--error)' }}>This ticket has been escalated. No further actions available until admin responds.</p>
                                    </div>
                                ) : selectedTicket.status === 'closed' ? (
                                    <div className="flex-1 p-4 rounded-2xl text-center" style={{ background: 'var(--success-soft)', border: '1px solid var(--success-border)' }}>
                                        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--success)' }}>✓ Ticket Closed</p>
                                        <p className="text-[10px] mt-1" style={{ color: 'var(--success)' }}>This ticket has been resolved and closed.</p>
                                    </div>
                                ) : selectedTicket.status === 'open' ? (
                                    <div className="flex-1 flex flex-col gap-3">
                                        <div className="p-4 rounded-2xl text-center" style={{ background: 'var(--warning-soft)', border: '1px solid var(--warning-border)' }}>
                                            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--warning)' }}>📢 Available Ticket</p>
                                            <p className="text-[10px] mt-1" style={{ color: 'var(--warning)' }}>This ticket is currently in the open pool. Claim it to start working on it immediately.</p>
                                        </div>
                                        <button 
                                            onClick={() => handleAccept(selectedTicket)}
                                            disabled={isActionPending}
                                            className={`w-full py-4 px-6 rounded-2xl text-[10px] font-semibold uppercase tracking-widest text-white shadow-xl transition-all ${isActionPending ? 'bg-slate-400' : ''}`}
                                            style={{ background: isActionPending ? '' : 'var(--accent)' }}
                                        >
                                            {isActionPending ? 'Claiming...' : '✓ Claim'}
                                        </button>
                                    </div>
                                ) : selectedTicket.status === 'assigned' ? (
                                    <div className="flex-1 flex flex-col gap-3">
                                        <div className="p-4 rounded-2xl text-center" style={{ background: 'var(--warning-soft)', border: '1px solid var(--warning-border)' }}>
                                            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--warning)' }}>⚠️ Work Not Started</p>
                                            <p className="text-[10px] mt-1" style={{ color: 'var(--warning)' }}>You must transition this ticket to In Progress before resolving or escalating it.</p>
                                        </div>
                                        <button 
                                            onClick={() => handleStartWork(selectedTicket)}
                                            disabled={isActionPending}
                                            className={`w-full py-4 px-6 rounded-2xl text-[10px] font-semibold uppercase tracking-widest text-white shadow-xl transition-all ${isActionPending ? 'bg-slate-400' : ''}`}
                                            style={{ background: isActionPending ? '' : 'var(--accent)' }}
                                        >
                                            {isActionPending ? 'Starting Work...' : '▶ Start Work'}
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            onClick={handleResolve}
                                            disabled={isActionLoading}
                                            className={`flex-1 py-4 px-6 rounded-2xl text-[10px] font-semibold uppercase tracking-widest text-white shadow-xl transition-all ${isActionLoading ? 'bg-slate-400' : ''}`}
                                            style={{ background: isActionLoading ? '' : 'var(--accent)' }}
                                        >
                                            {isActionLoading ? 'Processing...' : 'Mark as Resolved'}
                                        </button>
                                        <button
                                            onClick={handleEscalate}
                                            disabled={isActionLoading}
                                            className={`py-4 px-6 rounded-2xl text-[10px] font-semibold uppercase tracking-widest transition-all ${
                                                isActionLoading 
                                                ? '' 
                                                : ''
                                            }`}
                                            style={{
                                                color: isActionLoading ? 'var(--text-tertiary)' : 'var(--error)',
                                                background: isActionLoading ? 'var(--bg-elevated)' : 'var(--error-soft)',
                                                border: isActionLoading ? '1px solid var(--border)' : '1px solid var(--error-border)'
                                            }}
                                        >
                                            Escalate Issue ⚠
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
