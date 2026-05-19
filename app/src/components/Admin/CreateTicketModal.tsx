"use client";

import React, { useState, useEffect } from "react";
import { ticketService } from "../../lib/services/ticketService";
import { employeeService, EmployeeProfile } from "../../lib/services/employeeService";
import { useAuth } from "../../lib/AuthContext";
import { ErrorHandler } from "../../lib/utils/errorHandler";

interface CreateTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateTicketModal({ isOpen, onClose, onSuccess }: CreateTicketModalProps) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [employees, setEmployees] = useState<EmployeeProfile[]>([]);

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        issue_type: "Hardware",
        atm_id: "",
        bank_id: "",
        atm_location: "",
        bank_location: "",
        assigned_to: "",
    });

    // Fetch engineers when modal opens
    useEffect(() => {
        if (isOpen) {
            employeeService.getEmployees()
                .then(setEmployees)
                .catch(err => console.error("Could not load engineers:", err));
        }
    }, [isOpen]);

    if (!isOpen) return null;

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
            });
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

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">ATM ID</label>
                            <input 
                                required
                                value={formData.atm_id}
                                onChange={(e) => setFormData({...formData, atm_id: e.target.value})}
                                placeholder="Enter ATM ID"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Bank ID</label>
                            <input 
                                required
                                value={formData.bank_id}
                                onChange={(e) => setFormData({...formData, bank_id: e.target.value})}
                                placeholder="Enter Bank ID"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Location (Google Maps/Address)</label>
                            <input 
                                required
                                value={formData.atm_location}
                                onChange={(e) => setFormData({...formData, atm_location: e.target.value})}
                                placeholder="Link or Address"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                            />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                Assign to Engineer <span className="text-slate-600 normal-case font-normal">(optional — leave blank for open pool)</span>
                            </label>
                            <select
                                value={formData.assigned_to}
                                onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all appearance-none"
                            >
                                <option className="bg-[#0f172a]" value="">— Open Pool (unassigned) —</option>
                                {employees
                                    .filter(emp => emp.status === 'active')
                                    .map(emp => (
                                    <option key={emp.firebase_uid} className="bg-[#0f172a]" value={emp.firebase_uid}>
                                        {emp.full_name || emp.email} ({emp.employee_id}) — {emp.active_tickets} active
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

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
                            disabled={isLoading}
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
