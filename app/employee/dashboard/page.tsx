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

export default function EmployeeDashboard() {
    const { user, role, logout } = useAuth();
    const [tickets, setTickets] = useState<Ticket[]>([]);

    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isActionPending, setIsActionPending] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [actionNotes, setActionNotes] = useState("");
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [actionError, setActionError] = useState<string | null>(null);

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
            const data = await ticketService.getEmployeeTickets();
            setTickets(data);
        } catch (error) {
            console.error("Failed to fetch tickets:", error);
        }
    }, [user]);

    useEffect(() => {
        if (user && role === "employee") {
            fetchTickets();
        }
    }, [user, role, fetchTickets]);

    // Supabase Realtime Listener
    useEffect(() => {
        if (!user || role !== "employee") return;

        const channel = supabase
            .channel('employee-db-changes')
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


    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-6 md:p-10 px-4 sm:px-6 font-sans selection:bg-emerald-100">
            {/* Top Navigation */}
            <nav className="flex flex-col gap-6 sm:flex-row sm:items-center justify-between mb-10 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <img 
                        src="/images/prime_services_logo.png?v=1" 
                        alt="Prime Services ATM Services & Maintenance" 
                        className="w-12 h-12 object-contain"
                    />
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tighter italic text-emerald-600 flex items-center gap-3">
                            Prime <span className="text-slate-900">Services CRM</span>
                            <span className="not-italic text-[9px] bg-slate-900 text-white px-2 py-0.5 rounded-md tracking-widest font-black uppercase shadow-lg shadow-slate-900/20">Beta v1.0</span>
                        </h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Live Operations Console</p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
                    <div className="text-right sm:text-left">
                        <p className="text-xs font-black text-slate-900">{user?.email}</p>
                        <p className="text-[9px] text-emerald-600 uppercase tracking-widest font-black leading-none mt-1 bg-emerald-50 px-2 py-1 rounded-full">Field Engineer</p>
                    </div>
                    <button
                        onClick={() => logout()}
                        className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-slate-900/10"
                    >
                        Sign Out
                    </button>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto space-y-10">
                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">My Tasks</p>
                        <p className="text-3xl font-black text-slate-900 italic">{myTickets.length}</p>
                    </div>
                    <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Available</p>
                        <p className="text-3xl font-black text-emerald-600 italic">{availableTickets.length}</p>
                    </div>
                    <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Resolved</p>
                        <p className="text-3xl font-black text-slate-900 italic">
                            {tickets.filter(t => t.assigned_to === user?.uid && t.status === 'closed').length}
                        </p>
                    </div>
                    <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">In Progress</p>
                        <p className="text-3xl font-black text-slate-900 italic">
                            {myTickets.filter(t => t.status === 'in_progress').length}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Active */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-black italic uppercase tracking-tight">Active Assignments</h2>
                            <span className="w-8 h-1 bg-emerald-600 rounded-full"></span>
                        </div>

                        <div className="space-y-4">
                            {myTickets.length === 0 ? (
                                <div className="bg-white rounded-[2rem] p-10 sm:p-16 text-center border-2 border-dashed border-slate-200">
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest italic">No active deployments</p>
                                </div>
                            ) : (
                                myTickets.map(ticket => (
                                    <div key={ticket.id} className="bg-white border border-slate-200/60 rounded-[2rem] p-6 md:p-8 shadow-sm hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden">
                                        {/* Status Indicator Bar */}
                                        <div className={`absolute top-0 left-0 w-full h-1.5 transition-colors duration-300 ${ticket.status === 'in_progress' ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`}></div>

                                        <div className="flex justify-between items-start mb-6 pt-2">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[10px] font-black text-slate-500 tracking-widest uppercase">{ticket.ticket_no}</p>
                                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${ticket.status === 'in_progress' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                        {ticket.issue_type}
                                                    </span>
                                                </div>
                                                <h4 className="text-xl md:text-2xl font-black text-slate-900 leading-tight group-hover:text-emerald-700 transition-colors">{ticket.title}</h4>
                                            </div>
                                            {ticket.status === 'in_progress' ? (
                                                <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-600 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg shadow-emerald-600/20">
                                                    <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                                                    Working
                                                </span>
                                            ) : ticket.status === 're_raised' ? (
                                                <span className="text-[9px] font-black uppercase tracking-widest bg-red-500 text-white px-4 py-2 rounded-full shadow-lg shadow-red-500/20">Escalated</span>
                                            ) : (
                                                <span className="text-[9px] font-black uppercase tracking-widest bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg shadow-amber-500/20">Assigned</span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                            <div className="flex items-center gap-4 bg-gradient-to-br from-slate-50 to-slate-100/50 p-4 rounded-2xl border border-slate-100 group-hover:border-emerald-100 transition-colors min-w-0">
                                                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-slate-400 group-hover:text-emerald-500 group-hover:scale-110 transition-all shrink-0">
                                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Atm Location</p>
                                                    {ticket.atm_location?.startsWith('http') ? (
                                                        <a 
                                                            href={ticket.atm_location} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="text-sm font-bold text-emerald-600 hover:text-emerald-500 hover:underline flex items-center gap-1 transition-colors truncate"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            View Map ↗
                                                        </a>
                                                    ) : (
                                                        <p className="text-sm font-bold text-slate-800 truncate">{ticket.atm_location}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-4 min-w-0">
                                                <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100/50 p-4 rounded-2xl border border-slate-100 group-hover:border-emerald-100 transition-colors min-w-0">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Bank</p>
                                                    <p className="text-sm font-bold text-slate-800 truncate">{ticket.bank_id}</p>
                                                </div>
                                                <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100/50 p-4 rounded-2xl border border-slate-100 group-hover:border-emerald-100 transition-colors min-w-0">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Terminal</p>
                                                    <p className="text-sm font-bold text-slate-800 truncate">{ticket.atm_id}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-3">
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
                                                className="flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white bg-slate-900 hover:bg-emerald-600 transition-all shadow-lg shadow-slate-900/10 hover:shadow-emerald-600/20 hover:scale-[1.02] active:scale-95"
                                            >
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    {/* Open Pool */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-black italic uppercase tracking-tight">Open Deployment Pool</h2>
                            <span className="w-8 h-1 bg-amber-500 rounded-full"></span>
                        </div>

                        <div className="space-y-4">
                            {availableTickets.length === 0 ? (
                                <div className="bg-white rounded-[2rem] p-10 sm:p-16 text-center border-2 border-dashed border-slate-200">
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest italic">All sites operational</p>
                                </div>
                            ) : (
                                availableTickets.map(ticket => (
                                    <div key={ticket.id} className="bg-white border border-slate-200/60 rounded-[2rem] p-6 md:p-8 shadow-sm hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden">
                                        {/* Status Indicator Bar */}
                                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-400 to-indigo-500"></div>

                                        <div className="flex justify-between items-start mb-6 pt-2">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[10px] font-black text-slate-500 tracking-widest uppercase">{ticket.ticket_no}</p>
                                                    <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-blue-50 text-blue-600">
                                                        {ticket.issue_type}
                                                    </span>
                                                </div>
                                                <h4 className="text-xl md:text-2xl font-black text-slate-900 leading-tight group-hover:text-emerald-700 transition-colors">{ticket.title}</h4>
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-widest bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg shadow-blue-500/20">Available</span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                            <div className="flex items-center gap-4 bg-gradient-to-br from-slate-50 to-slate-100/50 p-4 rounded-2xl border border-slate-100 group-hover:border-emerald-100 transition-colors min-w-0">
                                                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-slate-400 group-hover:text-emerald-500 group-hover:scale-110 transition-all shrink-0">
                                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Atm Location</p>
                                                    {ticket.atm_location?.startsWith('http') ? (
                                                        <a 
                                                            href={ticket.atm_location} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="text-sm font-bold text-emerald-600 hover:text-emerald-500 hover:underline flex items-center gap-1 transition-colors truncate"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            View Map ↗
                                                        </a>
                                                    ) : (
                                                        <p className="text-sm font-bold text-slate-800 truncate">{ticket.atm_location}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-4 min-w-0">
                                                <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100/50 p-4 rounded-2xl border border-slate-100 group-hover:border-emerald-100 transition-colors min-w-0">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Bank</p>
                                                    <p className="text-sm font-bold text-slate-800 truncate">{ticket.bank_id}</p>
                                                </div>
                                                <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100/50 p-4 rounded-2xl border border-slate-100 group-hover:border-emerald-100 transition-colors min-w-0">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Terminal</p>
                                                    <p className="text-sm font-bold text-slate-800 truncate">{ticket.atm_id}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <button
                                                onClick={() => handleAccept(ticket)}
                                                className="flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all hover:scale-[1.02] active:scale-95"
                                            >
                                                ✓ Claim
                                            </button>
                                            <button 
                                                onClick={() => setSelectedTicket(ticket)}
                                                className="flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white bg-slate-900 hover:bg-emerald-600 transition-all shadow-lg shadow-slate-900/10 hover:shadow-emerald-600/20 hover:scale-[1.02] active:scale-95"
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
                            <h2 className="text-xl font-black italic uppercase tracking-tight">Resolved History</h2>
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Audit trail of completed deployments</p>
                        </div>
                        <span className="w-8 h-1 bg-slate-300 rounded-full"></span>
                    </div>

                    <div className="bg-white border border-slate-200/60 rounded-[2rem] overflow-hidden shadow-sm">
                        <div className="overflow-x-auto pb-2">
                            <table className="w-full min-w-[720px] text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="px-4 py-3 sm:px-8 sm:py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Ticket #</th>
                                        <th className="px-4 py-3 sm:px-8 sm:py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Issue</th>
                                        <th className="px-4 py-3 sm:px-8 sm:py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Location</th>
                                        <th className="px-4 py-3 sm:px-8 sm:py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                        <th className="px-4 py-3 sm:px-8 sm:py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Completed</th>
                                        <th className="px-4 py-3 sm:px-8 sm:py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {resolvedTickets.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-16 sm:px-8 sm:py-20 text-center">
                                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest italic">No deployments completed yet</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        resolvedTickets.map(ticket => (
                                            <tr key={ticket.id} className="group hover:bg-slate-50/30 transition-colors">
                                                <td className="px-4 py-3 sm:px-8 sm:py-5">
                                                    <span className="text-xs font-black text-slate-900 font-mono">{ticket.ticket_no}</span>
                                                </td>
                                                <td className="px-4 py-3 sm:px-8 sm:py-5">
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-bold text-slate-800">{ticket.title}</p>
                                                        <span className="text-[9px] font-black px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded uppercase">{ticket.issue_type}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 sm:px-8 sm:py-5 max-w-[200px]">
                                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 min-w-0">
                                                        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                                                        {ticket.atm_location?.startsWith('http') ? (
                                                            <a 
                                                                href={ticket.atm_location} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                className="text-emerald-600 hover:underline truncate"
                                                            >
                                                                View Map ↗
                                                            </a>
                                                        ) : (
                                                            <span className="truncate">{ticket.atm_location}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 sm:px-8 sm:py-5">
                                                    <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-600 text-white px-3 py-1.5 rounded-full shadow-lg shadow-emerald-600/10">Resolved</span>
                                                </td>
                                                <td className="px-4 py-3 sm:px-8 sm:py-5">
                                                    <p className="text-xs font-bold text-slate-400">{new Date(ticket.updated_at || ticket.created_at || '').toLocaleDateString()}</p>
                                                </td>
                                                <td className="px-4 py-3 sm:px-8 sm:py-5">
                                                    <button
                                                        onClick={() => setSelectedTicket(ticket)}
                                                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                                        title="View Evidence"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            </main>

            {/* Ticket Detail Modal */}
            {selectedTicket && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-4xl h-auto md:h-[600px] max-h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col md:flex-row">
                        {/* Map/Image Side */}
                        <div className="md:w-5/12 bg-emerald-900 relative p-6 md:p-8 flex flex-col justify-between text-white hidden md:flex">
                            <div className="absolute inset-0 opacity-20 bg-[url('https://www.google.com/maps/vt/pb=!1m4!1m3!1i12!2i2345!3i1234!2m3!1e0!2sm!3i420120488!3m8!2sen!3sus!5e1105!12m4!1e68!2m2!1sset!2sRoadmap!4e0!5m1!1f2!6m8!1e1!2m2!1sIAq6iy_B_8EAAAQ0OEZpBQ!2e7!3e15!6m1!1i1!23i1308886')] bg-cover grayscale hover:grayscale-0 transition-all duration-700"></div>
                            <div className="relative z-10">
                                <span className="bg-emerald-500 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">{selectedTicket.status}</span>
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
                        <div className="md:w-7/12 relative flex flex-col min-h-0 h-full bg-white">
                            <button onClick={() => setSelectedTicket(null)} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all z-20 shadow-sm">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>

                            <div className="flex-1 overflow-y-auto p-6 md:p-8 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                                <div className="flex items-center gap-3 mb-2 pr-8">
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{selectedTicket.issue_type} Fault Detected</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                </div>
                                <h3 className="text-3xl font-black text-slate-900 leading-tight mb-6 pr-8">{selectedTicket.title}</h3>

                                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 mb-6 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-slate-300"></div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Engineer Briefing</p>
                                    <p className="text-slate-700 text-sm leading-relaxed font-medium whitespace-pre-wrap ml-2">{selectedTicket.description}</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                    <div className="p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border border-slate-100">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Bank Network</p>
                                        <p className="text-sm font-bold text-slate-800 line-clamp-1">{selectedTicket.bank_id}</p>
                                    </div>
                                    <div className="p-5 bg-gradient-to-br from-red-50 to-red-100/50 rounded-2xl border border-red-100">
                                        <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1">Priority</p>
                                        <p className="text-sm font-black text-red-600 tracking-wider">
                                            {String(selectedTicket.priority || selectedTicket.issue_type || "Standard").toUpperCase()}
                                        </p>
                                    </div>
                                </div>

                                {selectedTicket.status !== 're_raised' && selectedTicket.status !== 'closed' && (
                                    <div className="mt-6 mb-6 animate-in fade-in duration-300">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Proof of Work (Photo / Video)</label>
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                            <label className="cursor-pointer group flex items-center justify-center gap-2 bg-white hover:bg-emerald-50 border-2 border-dashed border-slate-200 hover:border-emerald-400 text-slate-500 px-6 py-4 rounded-2xl transition-all w-full sm:w-auto min-w-[200px]">
                                                <svg className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                <span className="text-[11px] font-black uppercase tracking-wider group-hover:text-emerald-600 transition-colors">Select Media</span>
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
                                                <div className="flex items-center gap-3 bg-emerald-50 px-4 py-4 rounded-2xl border border-emerald-100 flex-1 min-w-0 w-full shadow-sm">
                                                    <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    <span className="text-xs text-emerald-800 font-bold truncate">
                                                        {selectedFile.name}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 px-4 py-4 flex-1 min-w-0 w-full">
                                                    <span className="text-xs text-slate-400 font-medium italic">No media selected yet</span>
                                                </div>
                                            )}
                                        </div>

                                        {isActionLoading && uploadProgress > 0 && (
                                            <div className="mt-5 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                                <div className="flex justify-between items-center mb-2">
                                                    <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Uploading Media</p>
                                                    <p className="text-[10px] text-emerald-600 font-black">{Math.round(uploadProgress)}%</p>
                                                </div>
                                                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                                    <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300 relative" style={{ width: `${uploadProgress}%` }}>
                                                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {(selectedTicket.status === 're_raised' || selectedTicket.status === 'closed') && selectedTicket.proof_media_url && (
                                    <div className="mt-6 mb-6 animate-in fade-in duration-300">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Submitted Proof of Work</label>
                                        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm max-w-md bg-slate-50">
                                            {selectedTicket.proof_media_url.match(/\.(mp4|mov|webm)$/i) || selectedTicket.proof_media_url.includes("video") ? (
                                                <video src={selectedTicket.proof_media_url} controls className="w-full max-h-60 object-contain bg-black" />
                                            ) : (
                                                <img src={selectedTicket.proof_media_url} alt="Proof of Work" className="w-full max-h-60 object-cover" />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {selectedTicket.status !== 're_raised' && selectedTicket.status !== 'closed' && (
                                    <div className="mt-4 animate-in fade-in duration-300">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                                            {actionError?.includes("Reason") ? (
                                                <span className="text-red-500 flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                    Reason for Escalation (REQUIRED)
                                                </span>
                                            ) : (
                                                "Resolution / Escalation Notes"
                                            )}
                                        </label>
                                        <textarea
                                            className={`w-full bg-slate-50 border rounded-2xl p-4 text-sm outline-none transition-all resize-none shadow-inner ${actionError?.includes("Reason") ? 'border-red-300 ring-2 ring-red-500/20 bg-red-50/30' : 'border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white'}`}
                                            rows={4}
                                            placeholder="Explain the issue or reason for escalation here for Admin review..."
                                            value={actionNotes}
                                            onChange={(e) => setActionNotes(e.target.value)}
                                            disabled={isActionLoading}
                                        />

                                        {actionError && !actionError.includes("Reason") && (
                                            <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-bold flex items-start gap-3 shadow-sm">
                                                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                <p>{actionError}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {(selectedTicket.status === 're_raised' || selectedTicket.status === 'closed') && selectedTicket.resolution_notes && (
                                    <div className="mt-6 mb-6 p-5 bg-slate-50 rounded-3xl border border-slate-100 animate-in fade-in duration-300">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                            {selectedTicket.status === 're_raised' ? "Escalation Reason" : "Resolution Notes"}
                                        </p>
                                        <p className="text-slate-700 text-sm leading-relaxed font-medium whitespace-pre-wrap">{selectedTicket.resolution_notes}</p>
                                    </div>
                                )}
                            </div>

                            <div className="px-6 pb-6 md:px-8 md:pb-8 pt-4 border-t border-slate-100 flex gap-4 shrink-0 bg-white z-10 w-full">
                                {selectedTicket.status === 're_raised' ? (
                                    <div className="flex-1 p-4 bg-red-50 border border-red-200 rounded-2xl text-center">
                                        <p className="text-xs font-black text-red-600 uppercase tracking-widest">⏳ Pending Admin Review</p>
                                        <p className="text-[10px] text-red-400 mt-1">This ticket has been escalated. No further actions available until admin responds.</p>
                                    </div>
                                ) : selectedTicket.status === 'closed' ? (
                                    <div className="flex-1 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                                        <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">✓ Ticket Closed</p>
                                        <p className="text-[10px] text-emerald-400 mt-1">This ticket has been resolved and closed.</p>
                                    </div>
                                ) : selectedTicket.status === 'open' ? (
                                    <div className="flex-1 flex flex-col gap-3">
                                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-center">
                                            <p className="text-xs font-black text-blue-700 uppercase tracking-widest">📢 Available Ticket</p>
                                            <p className="text-[10px] text-blue-600 mt-1">This ticket is currently in the open pool. Claim it to start working on it immediately.</p>
                                        </div>
                                        <button 
                                            onClick={() => handleAccept(selectedTicket)}
                                            disabled={isActionPending}
                                            className={`w-full py-4 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white shadow-xl transition-all ${isActionPending ? 'bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'}`}
                                        >
                                            {isActionPending ? 'Claiming...' : '✓ Claim'}
                                        </button>
                                    </div>
                                ) : selectedTicket.status === 'assigned' ? (
                                    <div className="flex-1 flex flex-col gap-3">
                                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center">
                                            <p className="text-xs font-black text-amber-700 uppercase tracking-widest">⚠️ Work Not Started</p>
                                            <p className="text-[10px] text-amber-600 mt-1">You must transition this ticket to In Progress before resolving or escalating it.</p>
                                        </div>
                                        <button 
                                            onClick={() => handleStartWork(selectedTicket)}
                                            disabled={isActionPending}
                                            className={`w-full py-4 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white shadow-xl transition-all ${isActionPending ? 'bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'}`}
                                        >
                                            {isActionPending ? 'Starting Work...' : '▶ Start Work'}
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            onClick={handleResolve}
                                            disabled={isActionLoading}
                                            className={`flex-1 py-4 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white shadow-xl transition-all ${isActionLoading ? 'bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'}`}
                                        >
                                            {isActionLoading ? 'Processing...' : 'Mark as Resolved'}
                                        </button>
                                        <button
                                            onClick={handleEscalate}
                                            disabled={isActionLoading}
                                            className={`py-4 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                                isActionLoading 
                                                ? 'text-slate-400 bg-slate-100' 
                                                : 'text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 hover:border-rose-200 shadow-lg shadow-rose-600/5'
                                            }`}
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
