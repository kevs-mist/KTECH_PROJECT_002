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
            const result = await ticketService.createTicket({
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
            console.error("CLIENT: Ticket Creation Error:", err);
            setError(ErrorHandler.format(err, "Failed to create ticket."));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center backdrop-blur-sm animate-in fade-in duration-300" style={{ background: 'rgba(0, 0, 0, 0.6)' }}>
            <div className="w-full max-w-lg md:rounded-[2rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300 h-[calc(100vh-80px)] md:h-auto md:max-h-[90vh] flex flex-col" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                {/* Drag Handle for Mobile */}
                <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
                    <div className="w-8 h-1 rounded-full" style={{ background: 'var(--border-subtle)' }}></div>
                </div>
                <div className="px-4 md:px-8 py-4 md:py-6 flex justify-between items-center shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <div>
                        <h2 className="text-lg md:text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Create New Ticket</h2>
                        <p className="text-xs uppercase tracking-widest font-bold mt-1" style={{ color: 'var(--text-tertiary)' }}>Issue Registration</p>
                    </div>
                    <button onClick={onClose} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors rounded-full" style={{ color: 'var(--text-tertiary)', background: 'var(--bg-elevated)' }}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 pb-32 md:pb-8 custom-scrollbar">
                    {error && (
                        <div className="p-4 text-xs rounded-xl" style={{ background: 'var(--error-soft)', border: '1px solid var(--error)', color: 'var(--error)' }}>
                            {error}
                        </div>
                    )}

                    {/* Step 1: ATM Selection */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest ml-1" style={{ color: 'var(--accent)' }}>Step 1 — Select ATM</label>
                        <ATMSelector
                            onATMSelect={handleATMSelect}
                            onError={(msg) => setError(msg)}
                        />
                    </div>

                    {/* Auto-populated ATM info */}
                    {selectedATM && (
                        <div className="p-4 rounded-xl space-y-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Bank Name</p>
                                    <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>{selectedATM.bank_name}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Location</p>
                                    <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>{selectedATM.location}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Address</p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{selectedATM.address}</p>
                            </div>
                        </div>
                    )}

                    {/* Auto-assigned Engineer */}
                    {autoAssignedEngineer && (
                        <div className="p-4 rounded-xl space-y-1" style={{ background: 'var(--success-soft)', border: '1px solid var(--success)' }}>
                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--success)' }}>✓ Auto-Assigned Engineer</p>
                            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{autoAssignedEngineer.engineer_name}</p>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{autoAssignedEngineer.engineer_email}</p>
                            {autoAssignedEngineer.distance_km && (
                                <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                    {autoAssignedEngineer.distance_km} km away • {autoAssignedEngineer.method === 'distance_based' ? 'GPS-based' : 'Master data'}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Step 2: Ticket Details (only show after ATM selection) */}
                    {selectedATM && (
                        <>
                            <div className="pt-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest ml-1" style={{ color: 'var(--accent)' }}>Step 2 — Ticket Details</label>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1" style={{ color: 'var(--text-tertiary)' }}>Ticket Title</label>
                                    <input 
                                        required
                                        minLength={5}
                                        value={formData.title}
                                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                                        placeholder="Brief Issue Summary"
                                        className="w-full rounded-xl px-4 py-3 text-base min-h-[48px] focus:outline-none transition-all"
                                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                    />
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1" style={{ color: 'var(--text-tertiary)' }}>Description</label>
                                    <textarea 
                                        required
                                        minLength={3}
                                        rows={3}
                                        value={formData.description}
                                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                                        placeholder="Describe the issue in detail..."
                                        className="w-full rounded-xl px-4 py-3 text-base min-h-[48px] focus:outline-none transition-all resize-none"
                                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1" style={{ color: 'var(--text-tertiary)' }}>Issue Type</label>
                                    <select 
                                        value={formData.issue_type}
                                        onChange={(e) => setFormData({...formData, issue_type: e.target.value})}
                                        className="w-full rounded-xl px-4 py-3 text-base min-h-[48px] focus:outline-none transition-all appearance-none"
                                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="Hardware">Hardware</option>
                                        <option value="Software">Software</option>
                                        <option value="Network">Network</option>
                                        <option value="Power">Power</option>
                                        <option value="Card Reader">Card Reader</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1" style={{ color: 'var(--text-tertiary)' }}>
                                        Override Engineer <span className="normal-case font-normal" style={{ color: 'var(--text-tertiary)' }}>(optional — leave to use auto-assigned)</span>
                                    </label>
                                    <select
                                        value={formData.assigned_to}
                                        onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                                        className="w-full rounded-xl px-4 py-3 text-base min-h-[48px] focus:outline-none transition-all appearance-none"
                                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                        disabled={employeesLoading}
                                    >
                                        {employeesLoading ? (
                                            <option value="" disabled>Loading engineers list...</option>
                                        ) : employeesError ? (
                                            <option value="" disabled>{employeesError}</option>
                                        ) : (
                                            <>
                                                <option value="">— Open Pool (unassigned) —</option>
                                                {employees
                                                    .filter(emp => emp.status === 'active')
                                                    .map(emp => (
                                                        <option key={emp.firebase_uid} value={emp.firebase_uid}>
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

                    <div className="fixed bottom-0 left-0 right-0 md:static px-4 pb-4 md:pb-0 pt-4 border-t safe-bottom shrink-0" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                        <div className="flex gap-3">
                            <button 
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-6 py-4 min-h-[52px] rounded-xl text-xs font-bold transition-all"
                                style={{ color: 'var(--text-tertiary)', background: 'var(--bg-elevated)' }}
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                disabled={isLoading || !selectedATM}
                                className="flex-[2] px-6 py-4 min-h-[52px] rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                                style={{ color: 'white', background: 'var(--accent)' }}
                            >
                                {isLoading ? "Creating..." : "Confirm & Create Ticket"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
