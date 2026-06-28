"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../src/lib/AuthContext";
import CreateTicketModal from "../../src/components/Admin/CreateTicketModal";
import Notifications from "../../src/components/common/Notifications";
import DataImportModal from "../../src/components/Admin/DataImportModal";
import { ticketService, Ticket } from "../../src/lib/services/ticketService";
import { employeeService, EmployeeProfile } from "../../src/lib/services/employeeService";
import { supabase } from "../../src/lib/supabase";
import { debounce } from "../../src/lib/utils/debounce";
import { ErrorHandler } from "../../src/lib/utils/errorHandler";
import { parseJsonResponse } from "../../src/lib/apiClient";
import { setEmployeeOnlineStatusAction } from "@/app/src/lib/actions/employeeActions";

/**
 * AdminDashboard
 * NOTE: fetchStats depends on `user` being non-null. Firebase restores the
 * auth session asynchronously, so we must wait for `loading` to be false and
 * `user` to be set before calling getIdToken() — otherwise currentUser is null
 * and every request silently fails with "Unauthorized".
 */
interface AdminRequest {
    id: string;
    firebase_uid: string;
    email: string;
    status: string;
    created_at: string;
}

export default function AdminDashboard() {
    const { user, loading: authLoading, logout } = useAuth();
    const router = useRouter();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [stats, setStats] = useState({ total: 0, open: 0, closed: 0, escalated: 0 });
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionPending, setIsActionPending] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isPulling, setIsPulling] = useState(false);
    const [pullProgress, setPullProgress] = useState(0);
    const [touchStartY, setTouchStartY] = useState(0);
    const isEngineerOnline = employees.find(emp => emp.firebase_uid === user?.uid)?.is_online === true || false;

    // Admin requests state
    const [requests, setRequests] = useState<AdminRequest[]>([]);
    const [requestsLoading, setRequestsLoading] = useState(true);
    const [secretCode, setSecretCode] = useState<{ [key: string]: string }>({});
    const [showSecretInput, setShowSecretInput] = useState<{ [key: string]: boolean }>({});
    const [requestError, setRequestError] = useState<string | null>(null);
    const [requestSuccess, setRequestSuccess] = useState<string | null>(null);

    const fetchStats = async () => {
        try {
            setIsLoading(true);
            setFetchError(null);
            const [statsData, ticketsData, employeesData] = await Promise.all([
                ticketService.getAdminStats(),
                ticketService.getAllTickets(),
                employeeService.getEmployees().catch(() => [])
            ]);
            setStats(statsData);
            setTickets(ticketsData);
            setEmployees(employeesData);
        } catch (err: any) {
            console.error("Failed to fetch dashboard data", err);
            setFetchError(err.message || "Failed to load tickets.");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchRequests = async () => {
        try {
            setRequestsLoading(true);
            setRequestError(null);
            const token = await user?.getIdToken(false);
            if (!token) throw new Error("Unauthorized: Please log in again.");

            const response = await fetch('/api/admin-requests', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await parseJsonResponse<{ data?: AdminRequest[] }>(response, "/api/admin-requests");
            setRequests(data.data || []);
        } catch (err: any) {
            setRequestError(err.message);
        } finally {
            setRequestsLoading(false);
        }
    };

    // Reusable debounced fetch that updates state without resetting screen loading state
    const debouncedFetch = React.useMemo(
        () => debounce(async () => {
            if (!user) return;
            try {
                const [statsData, ticketsData, employeesData] = await Promise.all([
                    ticketService.getAdminStats(),
                    ticketService.getAllTickets(),
                    employeeService.getEmployees().catch(() => [])
                ]);
                setStats(statsData);
                setTickets(ticketsData);
                setEmployees(employeesData);
            } catch (err: any) {
                console.error("Failed to fetch dashboard data in background", err);
            }
        }, 500),
        [user]
    );

    // Wait for Firebase to restore auth session before fetching.
    // Previously this ran with [] dep — auth.currentUser was null on first render
    // causing getIdToken() to throw "Unauthorized" silently every time.
    useEffect(() => {
        if (!authLoading && user) {
            fetchStats();
            fetchRequests();
        } else if (!authLoading && !user) {
            setIsLoading(false);
        }
    }, [authLoading, user]);

    // Supabase Realtime Listener
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`admin-dashboard-${user.uid}`)
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
                    debouncedFetch();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, debouncedFetch]);

    // Network Reconnect Recovery
    useEffect(() => {
        const handleOnline = () => {
            debouncedFetch();
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [debouncedFetch]);

    // 5-Second Auto-Refresh Polling Fallback
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(() => {
            debouncedFetch();
        }, 5000);
        return () => clearInterval(interval);
    }, [user, debouncedFetch]);

    const handleLogout = async () => {
        await logout();
        router.push("/login");
    };

    const handleCloseTicket = async (ticket: Ticket) => {
        if (isActionPending || !confirm(`Close ticket ${ticket.ticket_no}? This cannot be undone.`)) return;
        setIsActionPending(true);
        try {
            await ticketService.adminCloseTicket(ticket.id!, ticket.version || 1, "Closed manually by admin.");
            await fetchStats();
        } catch (err: any) {
            alert(ErrorHandler.format(err, "Failed to close ticket."));
        } finally {
            setIsActionPending(false);
        }
    };

    const handleReleaseTicket = async (ticket: Ticket) => {
        if (isActionPending || !confirm(`Release ticket ${ticket.ticket_no} back to the open pool? This will clear the current assignment and notes.`)) return;
        setIsActionPending(true);
        try {
            await ticketService.adminReleaseTicket(ticket.id!, ticket.version || 1);
            await fetchStats();
        } catch (err: any) {
            alert(ErrorHandler.format(err, "Failed to release ticket."));
        } finally {
            setIsActionPending(false);
        }
    };

    const handleApproveRequest = async (requestId: string) => {
        const code = secretCode[requestId];
        if (!code || code.length < 4) {
            setRequestError('Please enter a secret code (minimum 4 characters)');
            return;
        }

        try {
            const token = await user?.getIdToken(false);
            if (!token) throw new Error("Unauthorized: Please log in again.");

            const response = await fetch('/api/admin-requests/approve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ requestId, action: 'approve', secretCode: code })
            });
            await parseJsonResponse(response, "/api/admin-requests/approve");
            
            setRequestSuccess('Admin request approved successfully');
            setShowSecretInput({ ...showSecretInput, [requestId]: false });
            setSecretCode({ ...secretCode, [requestId]: '' });
            fetchRequests();
        } catch (err: any) {
            setRequestError(err.message);
        }
    };

    const handleRejectRequest = async (requestId: string) => {
        try {
            const token = await user?.getIdToken(false);
            if (!token) throw new Error("Unauthorized: Please log in again.");

            const response = await fetch('/api/admin-requests/approve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ requestId, action: 'reject' })
            });
            await parseJsonResponse(response, "/api/admin-requests/approve");
            
            setRequestSuccess('Admin request rejected');
            fetchRequests();
        } catch (err: any) {
            setRequestError(err.message);
        }
    };

    const getEngineerName = (uid?: string) => {
        if (!uid) return "Unassigned";
        const emp = employees.find(e => e.firebase_uid === uid);
        return emp ? (emp.full_name || 'Unnamed') : "Unassigned";
    };

    const handleExportExcel = () => {
        if (tickets.length === 0) {
            alert("No tickets available to export.");
            return;
        }

        const headers = [
            "Ticket No",
            "Title",
            "Description",
            "Issue Type",
            "Status",
            "Priority",
            "ATM ID",
            "Bank ID",
            "ATM Location",
            "Assigned Engineer",
            "Created By",
            "Created At",
            "Updated At",
            "Resolution Notes",
            "Proof Media"
        ];

        // Format HTML table rows
        const rowsHtml = tickets.map(ticket => {
            const engineerName = ticket.assigned_to ? getEngineerName(ticket.assigned_to) : "Unassigned";
            
            // Generate inline image or video link
            let mediaCell = "-";
            if (ticket.proof_media_url) {
                if (ticket.proof_media_url.match(/\.(mp4|mov|webm)$/i) || ticket.proof_media_url.includes("video")) {
                    mediaCell = `<a href="${ticket.proof_media_url}" target="_blank" style="color: #4f46e5; text-decoration: underline; font-weight: bold;">View Video</a>`;
                } else {
                    mediaCell = `<img src="${ticket.proof_media_url}" loading="lazy" width="100" height="75" style="border: 1px solid #cbd5e1; border-radius: 4px;" alt="Proof" />`;
                }
            }

            return `
                <tr>
                    <td style="font-family: monospace; font-weight: bold; color: #4f46e5;">${ticket.ticket_no || ""}</td>
                    <td>${ticket.title || ""}</td>
                    <td>
                        <button 
                        onclick={() => setSelectedTicket(ticket)}
                        class="text-[9px] font-black uppercase tracking-widest bg-white/5 
                        border border-white/10 px-3 py-1.5 
                        rounded-lg transition-all shrink-0"
                        title = "Click to view full description">

                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
                                            
                    </button>
                    <td>${ticket.issue_type || ""}</td>
                    <td>${ticket.status || ""}</td>
                    <td>${ticket.priority || ""}</td>
                    <td style="font-family: monospace;">${ticket.atm_id || ""}</td>
                    <td>${ticket.bank_id || ""}</td>
                    <td>${ticket.atm_location || ""}</td>
                    <td>${engineerName || ""} (${isEngineerOnline ? "Online" : "Offline"})</td>
                    <td>${ticket.created_by || ""}</td>
                    <td>${ticket.created_at ? new Date(ticket.created_at).toLocaleString() : ""}</td>
                    <td>${ticket.updated_at ? new Date(ticket.updated_at).toLocaleString() : ""}</td>
                    <td>
                        <button onclick={() => setSelectedTicket(ticket)}
                        class="text-[9px] font-black uppercase tracking-widest bg-white/5
                        border border-white/10 px-3 py-1.5
                        rounded-lg transition-all shrink-0"
                        title = "Click to view full resolution notes">
                         <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" 
                     viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    </button>
                    <td style="text-align: center; vertical-align: middle;">${mediaCell}</td>
                </tr>
            `;
        }).join("");

        const htmlContent = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
            <!--[if gte mso 9]>
            <xml>
             <x:ExcelWorkbook>
              <x:ExcelWorksheets>
               <x:ExcelWorksheet>
                <x:Name>Field CRM Export</x:Name>
                <x:WorksheetOptions>
                 <x:DisplayGridlines/>
                </x:WorksheetOptions>
               </x:ExcelWorksheet>
              </x:ExcelWorksheets>
             </x:ExcelWorkbook>
            </xml>
            <![endif]-->
            <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
            <style>
              table { border-collapse: collapse; font-family: sans-serif; font-size: 11px; }
              th { background-color: #4f46e5; color: #ffffff; font-weight: bold; text-align: left; border: 1px solid #cbd5e1; padding: 10px 8px; font-size: 12px; }
              td { border: 1px solid #e2e8f0; padding: 8px; vertical-align: middle; }
              tr:nth-child(even) { background-color: #f8fafc; }
            </style>
            </head>
            <body>
            <table>
              <thead>
                <tr>
                  ${headers.map(h => `<th>${h}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
            </body>
            </html>
        `;

        const blob = new Blob([htmlContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `mamas_crm_export_${new Date().toISOString().slice(0, 10)}.xls`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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
            await fetchStats();
        }
        setIsPulling(false);
        setPullProgress(0);
        setTouchStartY(0);
    };

    return (
        <div 
            className="min-h-screen" 
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
            <main className="p-4 md:p-8 max-w-7xl mx-auto page-enter safe-top">
                {/* Pending Admin Requests Card */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 mb-6">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
                        Pending Admin Requests
                    </p>
                    <p className="text-4xl font-bold text-[var(--text-primary)] leading-none mb-2">
                        {requestsLoading ? '--' : requests.length}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                        {requests.length === 0 ? 'No pending requests' : 'Require attention'}
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 items-stretch">
                    {[
                        { label: "Total System Tickets", value: stats.total, sublabel: "All time" },
                        { label: "Unresolved Issues", value: stats.open, sublabel: "Active now" },
                        { label: "Escalated Issues", value: stats.escalated, sublabel: "Require attention" },
                        { label: "Closed Tickets", value: stats.closed, sublabel: "Resolved" },
                    ].map(({ label, value, sublabel }, index) => (
                        <div key={label} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
                                {label}
                            </p>
                            <p className="text-4xl font-bold text-[var(--text-primary)] leading-none mb-2">
                                {isLoading ? '--' : value}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)]">
                                {sublabel}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Error banner */}
                {fetchError && (
                    <div className="mt-8 p-4 text-sm rounded-lg flex items-center gap-3" style={{ background: 'var(--error-soft)', border: '1px solid var(--error)', color: 'var(--error)' }}>
                        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                        <span><strong>Load failed:</strong> {fetchError}</span>
                        <button onClick={fetchStats} className="ml-auto text-xs underline" style={{ color: 'var(--error)' }}>Retry</button>
                    </div>
                )}

                {/* Operations Header */}
                <div className="mt-12 flex flex-col gap-4 md:flex-row md:items-end justify-between">
                    <Notifications />
                    <div>
                        <div className="mb-3">
                            <h2 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">Operational Controls</h2>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">Live Ticket Management & Deployment</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <button
                            onClick={handleExportExcel}
                            className="px-6 py-2.5 font-semibold text-xs uppercase tracking-widest transition-all flex items-center gap-2"
                            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '6px' }}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Export Excel
                        </button>
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="px-6 py-2.5 font-semibold text-xs uppercase tracking-widest transition-all flex items-center gap-2"
                            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '6px' }}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Import Data
                        </button>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-6 py-2.5 font-semibold text-xs uppercase tracking-widest transition-all"
                            style={{ background: 'var(--accent)', color: 'white', borderRadius: '6px' }}
                        >
                            + Create New Ticket
                        </button>
                    </div>
                </div>

                {/* Operations Bar: Search & Filters */}
                <div className="mt-8 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-1 p-1 rounded-lg w-full md:w-auto flex-wrap md:flex-nowrap md:overflow-x-auto no-scrollbar" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                        {["all", "open", "assigned", "in_progress", "re_raised", "closed"].map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`text-[11px] font-semibold uppercase tracking-widest px-4 py-2 rounded-md transition-all whitespace-nowrap ${
                                    filterStatus === s 
                                    ? "" 
                                    : ""
                                }`}
                                style={filterStatus === s 
                                    ? { background: 'var(--bg-elevated)', color: 'var(--text-primary)' }
                                    : { color: 'var(--text-secondary)' }
                                }
                            >
                                {s === 're_raised' ? 'Escalated' : s === 'in_progress' ? 'Working' : s}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full md:w-80 group">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <svg className="w-4 h-4 transition-colors" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input 
                            type="text"
                            placeholder="Search ATM ID or Bank ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-0 transition-all font-medium"
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                        />
                    </div>
                </div>

                {/* Recent Tickets List */}
                <div className="mt-12">
                    <div className="flex items-center justify-between mb-6 px-4">
                        <h3 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Recent Activity</h3>
                        <div className="h-px flex-1 mx-8" style={{ background: 'var(--border-subtle)' }}></div>
                    </div>

                    {/* Helper function for badge styles */}
                    {(() => {
                        const getBadgeStyle = (status: string) => {
                            const styles: Record<string, { bg: string; color: string; border: string }> = {
                                open: { bg: 'var(--accent-soft)', color: '#60a5fa', border: '#2563eb30' },
                                closed: { bg: 'var(--success-soft)', color: '#4ade80', border: '#16a34a30' },
                                re_raised: { bg: 'var(--error-soft)', color: '#f87171', border: '#dc262630' },
                                assigned: { bg: 'var(--accent-soft)', color: '#60a5fa', border: '#2563eb30' },
                                in_progress: { bg: 'var(--warning-soft)', color: '#fbbf24', border: '#d9770630' },
                            };
                            return styles[status] || { bg: 'var(--accent-soft)', color: '#60a5fa', border: '#2563eb30' };
                        };
                        return null;
                    })()}

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4 px-4">
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="p-4 rounded-xl animate-pulse" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                    <div className="h-4 w-24 bg-slate-200 rounded mb-2"></div>
                                    <div className="h-6 w-48 bg-slate-200 rounded mb-3"></div>
                                    <div className="h-3 w-32 bg-slate-200 rounded mb-2"></div>
                                    <div className="h-3 w-40 bg-slate-200 rounded"></div>
                                </div>
                            ))
                        ) : tickets.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-xs font-semibold uppercase tracking-widest italic" style={{ color: 'var(--text-secondary)' }}>No tickets found</p>
                            </div>
                        ) : (
                            tickets
                            .filter(t => {
                                const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
                                const search = searchQuery.toLowerCase();
                                const engineerName = t.assigned_to ? getEngineerName(t.assigned_to).toLowerCase() : "";
                                const matchesSearch = !search || 
                                    t.atm_id.toLowerCase().includes(search) || 
                                    t.bank_id.toLowerCase().includes(search) ||
                                    t.title.toLowerCase().includes(search) ||
                                    (t.ticket_no || '').toLowerCase().includes(search) ||
                                    engineerName.includes(search);
                                return matchesStatus && matchesSearch;
                            })
                            .slice(0, 20)
                            .map((ticket) => {
                                const getBadgeStyle = (status: string) => {
                                    const styles: Record<string, { bg: string; color: string; border: string }> = {
                                        open: { bg: 'var(--accent-soft)', color: '#60a5fa', border: '#2563eb30' },
                                        closed: { bg: 'var(--success-soft)', color: '#4ade80', border: '#16a34a30' },
                                        re_raised: { bg: 'var(--error-soft)', color: '#f87171', border: '#dc262630' },
                                        assigned: { bg: 'var(--accent-soft)', color: '#60a5fa', border: '#2563eb30' },
                                        in_progress: { bg: 'var(--warning-soft)', color: '#fbbf24', border: '#d9770630' },
                                    };
                                    return styles[status] || { bg: 'var(--accent-soft)', color: '#60a5fa', border: '#2563eb30' };
                                };
                                const badgeStyle = getBadgeStyle(ticket.status || 'open');
                                return (
                                    <div key={ticket.id} className="p-4 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="text-xs font-semibold font-mono" style={{ color: 'var(--text-secondary)' }}>{ticket.ticket_no}</p>
                                                <p className="text-[8px] font-semibold uppercase tracking-wider mt-1" style={{ color: 'var(--text-tertiary)' }}>{new Date(ticket.created_at || "").toLocaleDateString()}</p>
                                            </div>
                                            <span className="text-[8px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full" style={{ background: badgeStyle.bg, color: badgeStyle.color, border: `1px solid ${badgeStyle.border}` }}>
                                                {ticket.status}
                                            </span>
                                        </div>
                                        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{ticket.title}</p>
                                        <div className="space-y-2 mb-3">
                                            <div className="flex items-center gap-2 text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                                <span className="uppercase tracking-wider">ATM:</span>
                                                <span>{ticket.atm_id}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                                <span className="uppercase tracking-wider">Bank:</span>
                                                <span>{ticket.bank_id}</span>
                                            </div>
                                        </div>
                                        {ticket.assigned_to && (
                                            <div className="flex items-center gap-2 text-[10px] font-semibold mb-3" style={{ color: 'var(--accent)' }}>
                                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }}></span>
                                                <span>{getEngineerName(ticket.assigned_to)}</span>
                                            </div>
                                        )}
                                        <button
                                            onClick={() => setSelectedTicket(ticket)}
                                            className="w-full py-3 text-xs font-semibold uppercase tracking-widest rounded-lg"
                                            style={{ background: 'var(--accent)', color: 'white' }}
                                        >
                                            View Details
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto pb-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                        <table className="w-full min-w-[720px] text-left border-collapse">
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>ID</th>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Description</th>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>ATM / Bank</th>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-center" style={{ color: 'var(--text-secondary)' }}>Status</th>
                                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-right" style={{ color: 'var(--text-secondary)' }}>Action / Proof</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                            {Array.from({ length: 5 }).map((_, j) => (
                                                <td key={j} className="px-4 py-3">
                                                    <div className="h-4 rounded" style={{ width: `${60 + (j * 10) % 30}%`, background: 'var(--bg-elevated)' }} />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : tickets.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-16 text-center text-sm italic" style={{ color: 'var(--text-secondary)' }}>
                                            No tickets found in the system. Create one above to get started.
                                        </td>
                                    </tr>
                                ) : (
                                    tickets
                                    .filter(t => {
                                        const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
                                        const search = searchQuery.toLowerCase();
                                        const engineerName = t.assigned_to ? getEngineerName(t.assigned_to).toLowerCase() : "";
                                        const matchesSearch = !search || 
                                            t.atm_id.toLowerCase().includes(search) || 
                                            t.bank_id.toLowerCase().includes(search) ||
                                            t.title.toLowerCase().includes(search) ||
                                            (t.ticket_no || '').toLowerCase().includes(search) ||
                                            engineerName.includes(search);
                                        return matchesStatus && matchesSearch;
                                    })
                                    .map((ticket) => {
                                        const getBadgeStyle = (status: string) => {
                                            const styles: Record<string, { bg: string; color: string; border: string }> = {
                                                open: { bg: 'var(--accent-soft)', color: '#60a5fa', border: '#2563eb30' },
                                                closed: { bg: 'var(--success-soft)', color: '#4ade80', border: '#16a34a30' },
                                                re_raised: { bg: 'var(--error-soft)', color: '#f87171', border: '#dc262630' },
                                                assigned: { bg: 'var(--accent-soft)', color: '#60a5fa', border: '#2563eb30' },
                                                in_progress: { bg: 'var(--warning-soft)', color: '#fbbf24', border: '#d9770630' },
                                            };
                                            return styles[status] || { bg: 'var(--accent-soft)', color: '#60a5fa', border: '#2563eb30' };
                                        };
                                        const badgeStyle = getBadgeStyle(ticket.status || 'open');
                                        return (
                                        <tr key={ticket.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="transition-colors">
                                            <td className="px-4 py-3">
                                                <p className="text-xs font-semibold font-mono" style={{ color: 'var(--text-secondary)' }}>{ticket.ticket_no}</p>
                                                <p className="text-[11px] mt-1 uppercase font-semibold" style={{ color: 'var(--text-muted)' }}>{new Date(ticket.created_at || "").toLocaleDateString()}</p>
                                            </td>
                                            <td className="px-4 py-3 max-w-xs">
                                                <p className="text-sm font-semibold">{ticket.title}</p>
                                                <p className="text-xs line-clamp-1 mt-0.5" style={{ color: 'var(--text-secondary)' }}>{ticket.description}</p>
                                                {ticket.assigned_to && (
                                                    <p className="text-[11px] font-semibold uppercase tracking-widest mt-1.5 flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }}></span>
                                                        Eng: {getEngineerName(ticket.assigned_to)}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-xs font-semibold">{ticket.atm_id}</p>
                                                <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{ticket.bank_id}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-center">
                                                    <span className="text-[11px] font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full" style={{ background: badgeStyle.bg, color: badgeStyle.color, border: `1px solid ${badgeStyle.border}` }}>
                                                        {ticket.status === 're_raised' ? 'ESCALATED' : ticket.status === 'in_progress' ? 'WORKING' : ticket.status}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {ticket.status !== 'closed' && (
                                                        <button 
                                                            onClick={() => handleCloseTicket(ticket)}
                                                            className="text-[11px] font-semibold uppercase tracking-widest px-3 py-1.5 rounded-md transition-all shrink-0"
                                                            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '6px' }}
                                                        >
                                                            Close ✓
                                                        </button>
                                                    )}
                                                    {ticket.status === 're_raised' && (
                                                        <button 
                                                            onClick={() => handleReleaseTicket(ticket)}
                                                            className="text-[11px] font-semibold uppercase tracking-widest px-3 py-1.5 rounded-md transition-all shrink-0"
                                                            style={{ background: 'var(--warning-soft)', border: '1px solid var(--warning)', color: 'var(--warning)', borderRadius: '6px' }}
                                                        >
                                                            Release ↩
                                                        </button>
                                                    )}
                                                    {ticket.proof_media_url ? (
                                                        <a 
                                                            href={ticket.proof_media_url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="transition-colors"
                                                            style={{ color: 'var(--accent)' }}
                                                        >
                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                        </a>
                                                    ) : (
                                                        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>No Proof</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4 relative">
                        {/* FAB for creating new ticket */}
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="fixed bottom-[80px] right-4 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-50"
                            style={{ background: 'var(--accent)', color: 'white' }}
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="p-4 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
                                    <div className="h-4 rounded w-1/3 mb-3" style={{ background: 'var(--bg-surface)' }} />
                                    <div className="h-6 rounded w-3/4 mb-2" style={{ background: 'var(--bg-surface)' }} />
                                    <div className="h-4 rounded w-1/2" style={{ background: 'var(--bg-surface)' }} />
                                </div>
                            ))
                        ) : tickets.length === 0 ? (
                            <div className="p-8 text-center rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                <p className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>No tickets found in the system. Create one above to get started.</p>
                            </div>
                        ) : (
                            tickets
                            .filter(t => {
                                const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
                                const search = searchQuery.toLowerCase();
                                const engineerName = t.assigned_to ? getEngineerName(t.assigned_to).toLowerCase() : "";
                                const matchesSearch = !search || 
                                    t.atm_id.toLowerCase().includes(search) || 
                                    t.bank_id.toLowerCase().includes(search) ||
                                    t.title.toLowerCase().includes(search) ||
                                    (t.ticket_no || '').toLowerCase().includes(search) ||
                                    engineerName.includes(search);
                                return matchesStatus && matchesSearch;
                            })
                            .map((ticket) => {
                                const getBadgeStyle = (status: string) => {
                                    const styles: Record<string, { bg: string; color: string; border: string }> = {
                                        open: { bg: 'var(--accent-soft)', color: '#60a5fa', border: '#2563eb30' },
                                        closed: { bg: 'var(--success-soft)', color: '#4ade80', border: '#16a34a30' },
                                        re_raised: { bg: 'var(--error-soft)', color: '#f87171', border: '#dc262630' },
                                        assigned: { bg: 'var(--accent-soft)', color: '#60a5fa', border: '#2563eb30' },
                                        in_progress: { bg: 'var(--warning-soft)', color: '#fbbf24', border: '#d9770630' },
                                    };
                                    return styles[status] || { bg: 'var(--accent-soft)', color: '#60a5fa', border: '#2563eb30' };
                                };
                                const badgeStyle = getBadgeStyle(ticket.status || 'open');
                                return (
                                <div key={ticket.id} className="p-4 rounded-lg transition-colors cursor-pointer" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }} onClick={() => setSelectedTicket(ticket)}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="text-xs font-semibold font-mono" style={{ color: 'var(--text-secondary)' }}>{ticket.ticket_no}</p>
                                        </div>
                                        <span className="text-[11px] font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full" style={{ background: badgeStyle.bg, color: badgeStyle.color, border: `1px solid ${badgeStyle.border}` }}>
                                            {ticket.status === 're_raised' ? 'ESCALATED' : ticket.status === 'in_progress' ? 'WORKING' : ticket.status}
                                        </span>
                                    </div>
                                    <h4 className="text-sm font-semibold mb-1 line-clamp-2">{ticket.title}</h4>
                                    <div className="flex justify-between items-center mt-3">
                                        <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                                            <p className="text-xs font-semibold truncate max-w-[150px]">{ticket.atm_location || ticket.atm_id}</p>
                                        </div>
                                        <span className="text-[11px] font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full" style={{ background: 'var(--error-soft)', color: 'var(--error)', border: '1px solid var(--error-border)' }}>
                                            {ticket.priority || 'NORMAL'}
                                        </span>
                                    </div>
                                </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </main>

            <CreateTicketModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchStats}
            />

            <DataImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={fetchStats}
            />
        </div>
    );
}

