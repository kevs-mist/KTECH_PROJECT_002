"use client";

import React, { useState, useEffect, useRef } from "react";
import { ticketService } from "../../lib/services/ticketService";

export interface ATMLocation {
  id: string;
  atm_id: string;
  bank_name: string;
  location: string;
  address: string;
  engineer_name: string;
  engineer_contact: string;
  engineer_email: string;
}

export interface AssignedEngineer {
  engineer_name: string;
  engineer_id?: string;
  engineer_email: string;
  distance_km?: string;
  method?: string;
}

interface ATMSelectorProps {
  onATMSelect: (atm: ATMLocation | null, assignedEngineer: AssignedEngineer | null) => void;
  onError?: (error: string) => void;
}

export default function ATMSelector({ onATMSelect, onError }: ATMSelectorProps) {
  const [atms, setAtms] = useState<ATMLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingEngineer, setFetchingEngineer] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedATM, setSelectedATM] = useState<ATMLocation | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch ATMs
  useEffect(() => {
    async function fetchATMs() {
      try {
        setLoading(true);
        const token = await ticketService.getIdToken();
        const response = await fetch('/api/atm/list', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (!result.success) throw new Error(result.error || 'Failed to fetch ATMs');
        setAtms(result.data);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error fetching ATMs:', errorMsg);
        onError?.(errorMsg);
      } finally {
        setLoading(false);
      }
    }
    fetchATMs();
  }, [onError]);

  const handleSelect = async (atm: ATMLocation) => {
    setSelectedATM(atm);
    setSearch(`${atm.atm_id} - ${atm.bank_name}`);
    setIsOpen(false);
    
    try {
      setFetchingEngineer(true);
      const token = await ticketService.getIdToken();
      const response = await fetch('/api/atm/nearest-engineer', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ atmId: atm.atm_id })
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to find engineer');

      onATMSelect(atm, result.data);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error finding engineer:', errorMsg);
      onError?.(errorMsg);
      onATMSelect(atm, null); // Still pass the ATM even if engineer fails
    } finally {
      setFetchingEngineer(false);
    }
  };

  const handleClear = () => {
      setSelectedATM(null);
      setSearch("");
      onATMSelect(null, null);
  };

  const filteredATMs = atms.filter(atm => 
    atm.atm_id.toLowerCase().includes(search.toLowerCase()) || 
    atm.bank_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
            type="text"
            value={search}
            onChange={(e) => {
                setSearch(e.target.value);
                setIsOpen(true);
                if (selectedATM) handleClear();
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={loading ? "Loading ATMs..." : "Search ATM ID or Bank Name..."}
            disabled={loading}
            className="w-full rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none transition-all"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        {fetchingEngineer && (
            <div className="absolute right-3 w-4 h-4 rounded-full animate-spin" style={{ border: '2px solid var(--border-subtle)', borderTopColor: 'var(--accent)' }} />
        )}
        {!fetchingEngineer && search && (
            <button onClick={handleClear} className="absolute right-3 transition-colors" style={{ color: 'var(--text-tertiary)' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        )}
      </div>

      {isOpen && filteredATMs.length > 0 && !selectedATM && (
        <div className="absolute z-[110] w-full mt-2 rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            {filteredATMs.map(atm => (
                <button
                    key={atm.id}
                    onClick={() => handleSelect(atm)}
                    className="w-full text-left px-4 py-3 border-b transition-colors flex flex-col gap-1"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                    <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{atm.atm_id}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{atm.bank_name} - {atm.location}</span>
                </button>
            ))}
        </div>
      )}
      
        {isOpen && search && filteredATMs.length === 0 && !loading && !selectedATM && (
          <div className="absolute z-[110] w-full mt-2 rounded-xl shadow-2xl p-4 text-center text-xs" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-tertiary)' }}>
            No ATMs found matching &quot;{search}&quot;
          </div>
        )}
    </div>
  );
}
