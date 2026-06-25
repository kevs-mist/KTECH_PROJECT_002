"use client";

import React, { useState, useEffect } from "react";
import { ticketService } from "../../lib/services/ticketService";
import { employeeService, EmployeeProfile } from "../../lib/services/employeeService";
import { useAuth } from "../../lib/AuthContext";
import { ErrorHandler } from "../../lib/utils/errorHandler";
import ATMSelector, { ATMLocation, AssignedEngineer } from "./ATMSelector";

interface CreateTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

// Simple in-memory cache for employees data
let employeesCache: EmployeeProfile[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function CreateTicketModal({ isOpen, onClose, onSuccess }: CreateTicketModalProps) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
    const [employeesLoading, setEmployeesLoading] = useState(false);
    const [employeesError, setEmployeesError] = useState<string | null>(null);

    // ATM selection state
    const [selectedATM, setSelectedATM] = useState<ATMLocation | null>(null);
    const [autoAssignedEngineer, setAutoAssignedEngineer] = useState<AssignedEngineer | null>(null);

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        issue_type: "Hardware",
        atm_id: "",
        bank_id: "",
        atm_location: "",
        bank_location: "",
        assigned_to: "",
        atm_location_id: "",
    });

    // Fetch engineers when modal opens (with caching)
    useEffect(() => {
        if (isOpen) {
            const now = Date.now();
            const isCacheValid = cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION;

            if (isCacheValid && employeesCache) {
                setEmployees(employeesCache);
                setEmployeesLoading(false);
                setEmployeesError(null);
                return;
            }

            setEmployeesLoading(true);
            setEmployeesError(null);
            employeeService.getEmployees()
                .then(data => {
                    setEmployees(data);
                    employeesCache = data;
                    cacheTimestamp = Date.now();
                })
                .catch(err => {
                    console.error("Could not load engineers:", err);
                    setEmployeesError("Failed to load engineers list.");
                })
                .finally(() => {
                    setEmployeesLoading(false);
                });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleATMSelect = (atm: ATMLocation | null, engineer: AssignedEngineer | null) => {
        setSelectedATM(atm);
        setAutoAssignedEngineer(engineer);

        if (atm) {
            setFormData(prev => ({
                ...prev,
                atm_id: atm.atm_id,
                bank_id: atm.bank_name,
                atm_location: atm.address || atm.location,
                bank_location: atm.location,
                atm_location_id: atm.id,
                // Auto-assign if engineer has a firebase_uid (distance-based), otherwise leave for manual selection
                assigned_to: engineer?.engineer_id || prev.assigned_to,
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                atm_id: "",
                bank_id: "",
                atm_location: "",
                bank_location: "",
                atm_location_id: "",
                assigned_to: "",
            }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        setIsLoading(true);
        setError(null);

        try {
            await ticketService.createTicket({
                ...formData,
                assigned_to: formData.assigned_to || undefined,
                created_by: user?.uid || "admin",
                status: "open"
            });
            onSuccess();
            onClose();
            // Reset form
            setFormData({
                title: "",
                description: "",
                issue_type: "Hardware",
                atm_id: "",
                bank_id: "",
                atm_location: "",
                bank_location: "",
                assigned_to: "",
                atm_location_id: "",
            });
            setSelectedATM(null);
            setAutoAssignedEngineer(null);
        } catch (err: any) {
            console.error("Ticket Creation Error:", err);
            setError(ErrorHandler.format(err, "Failed to create ticket."));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[#0f172a] border border-white/10 w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white">Create New Ticket</h2>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-1">Issue Registration</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl">
                            {error}
                        </div>
                    )}

                    {/* Step 1: ATM Selection */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1">Step 1 — Select ATM</label>
                        <ATMSelector
                            onATMSelect={handleATMSelect}
                            onError={(msg) => setError(msg)}
                        />
                    </div>

                    {/* Auto-populated ATM info */}
                    {selectedATM && (
                        <div className="p-4 bg-white/[0.03] border border-white/10 rounded-xl space-y-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Bank Name</p>
                                    <p className="text-sm text-white font-medium mt-0.5">{selectedATM.bank_name}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Location</p>
                                    <p className="text-sm text-white font-medium mt-0.5">{selectedATM.location}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Address</p>
                                <p className="text-xs text-slate-300 mt-0.5">{selectedATM.address}</p>
                            </div>
                        </div>
                    )}

                    {/* Auto-assigned Engineer */}
                    {autoAssignedEngineer && (
                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-1">
                            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">✓ Auto-Assigned Engineer</p>
                            <p className="text-sm text-white font-bold">{autoAssignedEngineer.engineer_name}</p>
                            <p className="text-xs text-slate-400">{autoAssignedEngineer.engineer_email}</p>
                            {autoAssignedEngineer.distance_km && (
                                <p className="text-[10px] text-slate-500">
                                    {autoAssignedEngineer.distance_km} km away • {autoAssignedEngineer.method === 'distance_based' ? 'GPS-based' : 'Master data'}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Step 2: Ticket Details (only show after ATM selection) */}
                    {selectedATM && (
                        <>
                            <div className="pt-2">
                                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1">Step 2 — Ticket Details</label>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Ticket Title</label>
                                    <input 
                                        required
                                        minLength={5}
                                        value={formData.title}
                                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                                        placeholder="Brief Issue Summary"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                    />
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Description</label>
                                    <textarea 
                                        required
                                        minLength={10}
                                        rows={3}
                                        value={formData.description}
                                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                                        placeholder="Describe the issue in detail..."
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Issue Type</label>
                                    <select 
                                        value={formData.issue_type}
                                        onChange={(e) => setFormData({...formData, issue_type: e.target.value})}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all appearance-none"
                                    >
                                        <option className="bg-[#0f172a]" value="Hardware">Hardware</option>
                                        <option className="bg-[#0f172a]" value="Software">Software</option>
                                        <option className="bg-[#0f172a]" value="Network">Network</option>
                                        <option className="bg-[#0f172a]" value="Power">Power</option>
                                        <option className="bg-[#0f172a]" value="Card Reader">Card Reader</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                        Override Engineer <span className="text-slate-600 normal-case font-normal">(optional — leave to use auto-assigned)</span>
                                    </label>
                                    <select
                                        value={formData.assigned_to}
                                        onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all appearance-none"
                                        disabled={employeesLoading}
                                    >
                                        {employeesLoading ? (
                                            <option className="bg-[#0f172a]" value="" disabled>Loading engineers list...</option>
                                        ) : employeesError ? (
                                            <option className="bg-[#0f172a]" value="" disabled>{employeesError}</option>
                                        ) : (
                                            <>
                                                <option className="bg-[#0f172a]" value="">— Open Pool (unassigned) —</option>
                                                {employees
                                                    .filter(emp => emp.status === 'active')
                                                    .map(emp => (
                                                        <option key={emp.firebase_uid} className="bg-[#0f172a]" value={emp.firebase_uid}>
                                                            {emp.full_name || emp.email} ({emp.employee_id}) — {emp.active_tickets} active
                                                        </option>
                                                    ))}
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="pt-4 flex gap-3">
                        <button 
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={isLoading || !selectedATM}
                            className="flex-[2] px-6 py-3.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
                        >
                            {isLoading ? "Creating..." : "Confirm & Create Ticket"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
