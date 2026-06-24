"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../src/lib/AuthContext";
import CreateTicketModal from "../../src/components/Admin/CreateTicketModal";
import { ticketService, Ticket } from "../../src/lib/services/ticketService";
import { employeeService, EmployeeProfile } from "../../src/lib/services/employeeService";
import { supabase } from "../../src/lib/supabase";
import { debounce } from "../../src/lib/utils/debounce";
import { ErrorHandler } from "../../src/lib/utils/errorHandler";
import { parseJsonResponse } from "../../src/lib/apiClient";

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
    const [stats, setStats] = useState({ total: 0, open: 0, closed: 0, escalated: 0 });
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionPending, setIsActionPending] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    
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
            const token = await user?.getIdToken(true);
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
            .channel('admin-db-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tickets' },
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
            const token = await user?.getIdToken(true);
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
            const token = await user?.getIdToken(true);
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
                    mediaCell = `<img src="${ticket.proof_media_url}" width="100" height="75" style="border: 1px solid #cbd5e1; border-radius: 4px;" alt="Proof" />`;
                }
            }

            return `
                <tr>
                    <td style="font-family: monospace; font-weight: bold; color: #4f46e5;">${ticket.ticket_no || ""}</td>
                    <td>${ticket.title || ""}</td>
                    <td>${ticket.description || ""}</td>
                    <td>${ticket.issue_type || ""}</td>
                    <td>${ticket.status || ""}</td>
                    <td>${ticket.priority || ""}</td>
                    <td style="font-family: monospace;">${ticket.atm_id || ""}</td>
                    <td>${ticket.bank_id || ""}</td>
                    <td>${ticket.atm_location || ""}</td>
                    <td>${engineerName}</td>
                    <td>${ticket.created_by || ""}</td>
                    <td>${ticket.created_at ? new Date(ticket.created_at).toLocaleString() : ""}</td>
                    <td>${ticket.updated_at ? new Date(ticket.updated_at).toLocaleString() : ""}</td>
                    <td>${ticket.resolution_notes || ""}</td>
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

    return (
        <div className="min-h-screen bg-slate-900 text-white">
            <nav className="flex justify-between items-center px-8 py-6 border-b border-slate-800">
                <div className="flex items-center gap-4">
                    <img 
                        src="/images/prime_services_logo.png" 
                        alt="Prime Services ATM Services & Maintenance" 
                        className="w-12 h-12 object-contain"
                    />
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tighter italic">Prime <span className="text-indigo-400">Admin Hub</span></h1>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">System Management Console</p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-xs font-bold">{user?.email}</p>
                        <p className="text-[10px] text-indigo-400 uppercase tracking-widest">Administrator</p>
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="bg-slate-800 hover:bg-red-500/20 hover:text-red-400 border border-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition-all"
                    >
                        Terminate Session
                    </button>
                </div>
            </nav>

            <main className="p-8 max-w-7xl mx-auto">
                {/* Admin Requests Section */}
                <div className="mt-8 bg-white/[0.02] border border-white/5 rounded-[2rem] p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-black italic uppercase tracking-tighter">Pending Admin Requests</h3>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            {requests.length} Pending
                        </span>
                    </div>
                    
                    {requestError && (
                        <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                            {requestError}
                        </div>
                    )}
                    {requestSuccess && (
                        <div className="mb-4 bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg text-sm">
                            {requestSuccess}
                        </div>
                    )}
                    
                    {requestsLoading ? (
                        <div className="text-slate-400 text-sm">Loading requests...</div>
                    ) : requests.length === 0 ? (
                        <div className="text-slate-400 text-sm">No pending admin requests</div>
                    ) : (
                        <div className="space-y-4">
                            {requests.map((request) => (
                                <div key={request.id} className="bg-white/[0.03] border border-white/10 p-4 rounded-xl">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="font-bold text-sm text-white">{request.email}</p>
                                            <p className="text-xs text-slate-500">Requested: {new Date(request.created_at).toLocaleDateString()}</p>
                                        </div>
                                        <span className="bg-yellow-500/10 text-yellow-400 px-3 py-1 rounded-full text-xs font-bold uppercase">
                                            Pending
                                        </span>
                                    </div>
                                    
                                    {showSecretInput[request.id] ? (
                                        <div className="space-y-3">
                                            <input
                                                type="text"
                                                placeholder="Enter secret code (min 4 chars)"
                                                value={secretCode[request.id] || ''}
                                                onChange={(e) => setSecretCode({ ...secretCode, [request.id]: e.target.value })}
                                                className="w-full bg-white/[0.05] border border-white/10 px-4 py-3 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleApproveRequest(request.id)}
                                                    className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-xs font-bold transition-all"
                                                >
                                                    Approve with Code
                                                </button>
                                                <button
                                                    onClick={() => setShowSecretInput({ ...showSecretInput, [request.id]: false })}
                                                    className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-xs font-bold transition-all"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setShowSecretInput({ ...showSecretInput, [request.id]: true })}
                                                className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-xs font-bold transition-all"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleRejectRequest(request.id)}
                                                className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg text-xs font-bold transition-all"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
                    {[
                        { label: "Total System Tickets", value: stats.total, badge: "ALL TIME", badgeClass: "bg-indigo-500/10 text-indigo-400", hoverClass: "group-hover:text-indigo-400" },
                        { label: "Unresolved Issues", value: stats.open, badge: "ACTIVE NOW", badgeClass: "bg-amber-500/10 text-amber-400", hoverClass: "group-hover:text-amber-400" },
                        { label: "Escalated Issues", value: stats.escalated, badge: "CRITICAL REVIEW", badgeClass: "bg-red-500/10 text-red-400", hoverClass: "group-hover:text-red-400" },
                        { label: "Closed Tickets", value: stats.closed, badge: "SOLVED", badgeClass: "bg-emerald-500/10 text-emerald-400", hoverClass: "group-hover:text-emerald-400" },
                    ].map(({ label, value, badge, badgeClass, hoverClass }) => (
                        <div key={label} className="bg-white/[0.03] border border-white/10 p-8 rounded-[2rem] hover:bg-white/[0.05] transition-all group">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">{label}</p>
                            <div className="flex items-end justify-between">
                                {isLoading
                                    ? <div className="h-12 w-16 bg-white/5 rounded-xl animate-pulse" />
                                    : <p className={`text-5xl font-black italic text-white transition-colors ${hoverClass}`}>{value}</p>
                                }
                                <span className={`text-[10px] px-3 py-1 rounded-full font-bold ${badgeClass}`}>{badge}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Error banner */}
                {fetchError && (
                    <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-2xl flex items-center gap-3">
                        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                        <span><strong>Load failed:</strong> {fetchError}</span>
                        <button onClick={fetchStats} className="ml-auto text-xs underline hover:text-red-300">Retry</button>
                    </div>
                )}

                {/* Operations Header */}
                <div className="mt-12 flex items-end justify-between">
                    <div>
                        <h3 className="text-2xl font-black italic uppercase tracking-tighter">Operational Controls</h3>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Live Ticket Management & Deployment</p>
                    </div>
                    <div className="flex gap-4">
                        <button 
                            onClick={handleExportExcel}
                            className="bg-white/5 border border-white/10 hover:bg-white/10 text-white px-8 py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Export Excel
                        </button>
                        <button 
                            onClick={() => setIsModalOpen(true)}
                            className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20"
                        >
                            + Create New Ticket
                        </button>
                    </div>
                </div>

                {/* Operations Bar: Search & Filters */}
                <div className="mt-8 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5 w-full md:w-auto overflow-x-auto no-scrollbar">
                        {["all", "open", "assigned", "in_progress", "re_raised", "closed"].map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-xl transition-all whitespace-nowrap ${
                                    filterStatus === s 
                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                                }`}
                            >
                                {s === 're_raised' ? 'Escalated' : s === 'in_progress' ? 'Working' : s}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full md:w-80 group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <svg className="w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input 
                            type="text"
                            placeholder="Search ATM ID or Bank ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/[0.07] transition-all placeholder:text-slate-600 font-medium"
                        />
                    </div>
                </div>

                {/* Recent Tickets List */}
                <div className="mt-12">
                    <div className="flex items-center justify-between mb-6 px-4">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Recent Activity</h3>
                        <div className="h-px flex-1 bg-white/5 mx-8"></div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">ID</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">ATM / Bank</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Status</th>
                                    <th className="px-8 py-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Action / Proof</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    // Skeleton rows while waiting for auth + data fetch
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="border-b border-white/5">
                                            {Array.from({ length: 5 }).map((_, j) => (
                                                <td key={j} className="px-8 py-5">
                                                    <div className="h-4 bg-white/5 rounded-lg animate-pulse" style={{ width: `${60 + (j * 10) % 30}%` }} />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : tickets.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center text-slate-500 text-sm italic">
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
                                    .map((ticket) => (
                                        <tr key={ticket.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-8 py-5">
                                                <p className="text-xs font-black text-indigo-400 font-mono tracking-tighter">{ticket.ticket_no}</p>
                                                <p className="text-[9px] text-slate-600 mt-1 uppercase font-bold">{new Date(ticket.created_at || "").toLocaleDateString()}</p>
                                            </td>
                                            <td className="px-8 py-5 max-w-xs">
                                                <p className="text-sm font-bold text-slate-200">{ticket.title}</p>
                                                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{ticket.description}</p>
                                                {ticket.assigned_to && (
                                                    <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                                                        Eng: {getEngineerName(ticket.assigned_to)}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-8 py-5">
                                                <p className="text-xs font-bold text-slate-300">{ticket.atm_id}</p>
                                                <p className="text-[10px] text-slate-500 font-medium">{ticket.bank_id}</p>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex justify-center">
                                                    <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                                                        ticket.status === 'open' ? 'bg-amber-500/10 text-amber-500' :
                                                        ticket.status === 'closed' ? 'bg-emerald-500/10 text-emerald-400' :
                                                        ticket.status === 're_raised' ? 'bg-red-500/10 text-red-400' :
                                                        'bg-indigo-500/10 text-indigo-400'
                                                    }`}>
                                                        {ticket.status === 're_raised' ? 'ESCALATED' : ticket.status}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex items-center justify-end gap-4">
                                                    {ticket.status !== 'closed' && (
                                                        <button 
                                                            onClick={() => handleCloseTicket(ticket)}
                                                            className="text-[9px] font-black uppercase tracking-widest bg-white/5 hover:bg-emerald-500 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg transition-all shrink-0"
                                                        >
                                                            Close ✓
                                                        </button>
                                                    )}
                                                    {ticket.status === 're_raised' && (
                                                        <button 
                                                            onClick={() => handleReleaseTicket(ticket)}
                                                            className="text-[9px] font-black uppercase tracking-widest bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white border border-amber-500/20 px-3 py-1.5 rounded-lg transition-all shrink-0"
                                                        >
                                                            Release to Pool ↩
                                                        </button>
                                                    )}
                                                    {ticket.proof_media_url ? (
                                                        <div className="flex flex-col items-end gap-1.5">
                                                            <a href={ticket.proof_media_url} target="_blank" rel="noopener noreferrer" className="relative group block w-16 h-12 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-black/20">
                                                                <img src={ticket.proof_media_url} alt="Proof" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                                                <div className="absolute inset-0 bg-emerald-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                                </div>
                                                            </a>
                                                            {ticket.resolution_notes && (
                                                                <div className="text-[8px] text-slate-400 max-w-[120px] truncate italic" title={ticket.resolution_notes}>
                                                                    {ticket.resolution_notes}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : ticket.resolution_notes ? (
                                                        <div className="text-[9px] text-slate-500 max-w-[150px] truncate ml-auto italic" title={ticket.resolution_notes}>
                                                            {ticket.resolution_notes}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-700 italic">-</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            <CreateTicketModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchStats}
            />
        </div>
    );
}
